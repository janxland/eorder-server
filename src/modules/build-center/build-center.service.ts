/**
 * 构建中心服务
 * website: https://www.roginx.ink
 *
 * 职责（与 monorepo scripts/build-center 的 GitHub Actions 链路对接）：
 * 1. 触发构建 —— 包装 GitHub workflow_dispatch，落 MySQL 账本（started）
 * 2. 同步状态 —— 拉取 Actions run 终态收敛账本；成功时从账本 jsonl 反查版本号并回填指针
 * 3. promote  —— 把灰度版本目录 copyObject 到生产根指针（零删除、零覆盖版本目录）
 * 4. rollback —— 把旧版本 copyObject 回生产根指针（机制同 promote，账本记 rollback）
 * 5. 版本回收 —— 定时扫描 COS 版本目录落回收计划（只扫描不删除），
 *    删除必须由人在构建中心 UI 审批（cleanupApprove），审批即立即执行
 */

import { Injectable, Logger, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { BuildRecord } from './build-record.entity';
import { BuildPointer } from './build-pointer.entity';
import { BuildCleanup } from './build-cleanup.entity';
import { StorageConfig } from '@/modules/cloud-storage/entities/storage-config.entity';
import { CloudStorageFactory } from '@/modules/cloud-storage/providers/cloud-storage.factory';
import { GrayReleaseService } from '@/modules/gray-release/gray-release.service';
import { TriggerBuildDto, PromoteDto, RollbackDto, QueryBuildsDto, RecordExternalDto, VERSION_PATTERN } from './dto';

const GH_API = 'https://api.github.com';
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

@Injectable()
export class BuildCenterService implements OnModuleInit {
  private readonly logger = new Logger(BuildCenterService.name);

  /** GitHub 仓库与 workflow（env 可覆盖） */
  private readonly githubRepo = process.env.BUILD_CENTER_GITHUB_REPO || 'janxland/monorepo-qiankun-template';
  private readonly githubRef = process.env.BUILD_CENTER_GITHUB_REF || 'master';
  private readonly githubWorkflow = process.env.BUILD_CENTER_GITHUB_WORKFLOW || 'build-deploy.yml';

  /** 应用白名单（与 monorepo apps.json 对齐；env 可覆盖） */
  private readonly allowedApps = (process.env.BUILD_CENTER_APPS || 'vue-base,vue-app1,vue-app2,vue-app3,vue-build,vue-devops')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  /** 生产根指针所在的存储配置与对象前缀 */
  private readonly storageConfigName = process.env.BUILD_CENTER_STORAGE_CONFIG || '微前端部署';
  private readonly objectPrefix = (process.env.BUILD_CENTER_OBJECT_PREFIX || 'www/micro').replace(/\/+$/, '');

  constructor(
    @InjectRepository(BuildRecord)
    private readonly recordRepo: Repository<BuildRecord>,
    @InjectRepository(BuildPointer)
    private readonly pointerRepo: Repository<BuildPointer>,
    @InjectRepository(BuildCleanup)
    private readonly cleanupRepo: Repository<BuildCleanup>,
    @InjectRepository(StorageConfig)
    private readonly storageConfigRepo: Repository<StorageConfig>,
    private readonly cloudStorageFactory: CloudStorageFactory,
    private readonly grayReleaseService: GrayReleaseService,
  ) {}

  private githubToken(): string {
    const token = process.env.BUILD_CENTER_GITHUB_TOKEN;
    if (!token) {
      throw new BadRequestException('服务端未配置 BUILD_CENTER_GITHUB_TOKEN，无法触发 GitHub 构建');
    }
    return token;
  }

  private assertAllowedApp(appId: string) {
    if (!this.allowedApps.includes(appId)) {
      throw new BadRequestException(`应用 ${appId} 未注册（白名单: ${this.allowedApps.join(',')}）`);
    }
  }

  /** 部署域存储配置（构建中心专用存储配置名）——单一获取点 */
  private async deployStorageConfig() {
    const config = await this.storageConfigRepo.findOne({
      where: { name: this.storageConfigName, isEnabled: true },
    });
    if (!config) {
      throw new BadRequestException(`未找到存储配置「${this.storageConfigName}」`);
    }
    return config;
  }

  /** 部署域 provider（服务端长期密钥），逐一校验所需能力防呆——单一获取点 */
  private async deployProvider(...requiredCapabilities: string[]) {
    const config = await this.deployStorageConfig();
    const provider: any = await this.cloudStorageFactory.create(config);
    for (const cap of requiredCapabilities) {
      if (typeof provider[cap] !== 'function') {
        throw new BadRequestException(`存储类型 ${config.type} 不支持 ${cap}（当前仅实现 COS）`);
      }
    }
    return { config, provider };
  }

  /** 灰度绑定中的版本集合（绑定人数 > 0 的版本）——单一实现，扫描与审批共用 */
  private async grayBoundVersions(appId: string): Promise<Set<string>> {
    const stats = await this.grayReleaseService.getVersionStats(appId);
    return new Set(
      ((stats?.stats || []) as Array<{ version: string; userCount: number }>)
        .filter((s) => Number(s.userCount) > 0)
        .map((s) => s.version),
    );
  }

  // ==================== 触发构建 ====================

  async trigger(dto: TriggerBuildDto, triggeredBy: string) {
    const apps = [...new Set(dto.apps)];
    apps.forEach((a) => this.assertAllowedApp(a));
    const version = dto.version?.trim() || undefined;

    const records = await this.recordRepo.save(
      apps.map((appId) =>
        this.recordRepo.create({
          appId,
          version: version || null,
          target: 'gray',
          kind: 'build',
          status: 'started',
          triggeredBy: triggeredBy || null,
          startedAt: new Date(),
        }),
      ),
    );

    const dispatchAt = new Date();
    let runUrl: string | null = null;
    try {
      await axios.post(
        `${GH_API}/repos/${this.githubRepo}/actions/workflows/${this.githubWorkflow}/dispatches`,
        {
          ref: this.githubRef,
          inputs: { apps: apps.join(','), ...(version ? { version } : {}), target: dto.target || 'gray' },
        },
        {
          headers: { ...GH_HEADERS, Authorization: `Bearer ${this.githubToken()}` },
          validateStatus: (s) => s === 204,
          timeout: 15000,
        },
      );
    } catch (error) {
      const reason = `dispatch 失败: ${error?.response?.status || ''} ${error?.message}`;
      this.logger.error(`触发构建失败: ${reason}`);
      await this.recordRepo.save(
        records.map((r) => ({ ...r, status: 'failure', finishedAt: new Date(), detail: reason })),
      );
      throw new BadRequestException(`触发 GitHub 构建失败（${reason}），账本已记 failure`);
    }

    // dispatch 返回 204 无 runId，轮询 run 列表按创建时间捕获（排除已有记录占用的 run）
    try {
      const run = await this.captureNewRun(dispatchAt);
      if (run) {
        runUrl = run.html_url;
        await this.recordRepo.update(
          { id: In(records.map((r) => r.id)) },
          { runId: String(run.id), runUrl: run.html_url },
        );
      }
    } catch (error) {
      this.logger.warn(`捕获 runId 失败（不影响已派发的构建）: ${error?.message}`);
    }

    return {
      success: true,
      apps,
      version: version || '(自动: <短sha>-<run号>)',
      runUrl,
      records: records.map((r) => r.id),
    };
  }

  /** 轮询捕获刚 dispatch 出的新 run（最多 ~36s） */
  private async captureNewRun(dispatchAt: Date): Promise<any | null> {
    const usedRunIds = (
      await this.recordRepo.find({ where: { kind: 'build' }, select: ['runId'] })
    )
      .map((r) => r.runId)
      .filter(Boolean);

    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const resp = await axios.get(
        `${GH_API}/repos/${this.githubRepo}/actions/workflows/${this.githubWorkflow}/runs`,
        {
          headers: { ...GH_HEADERS, Authorization: `Bearer ${this.githubToken()}` },
          params: { event: 'workflow_dispatch', branch: this.githubRef, per_page: 15 },
          timeout: 15000,
        },
      );
      const runs = resp.data?.workflow_runs || [];
      const candidate = runs.find(
        (r: any) =>
          new Date(r.created_at).getTime() >= dispatchAt.getTime() - 5000 &&
          !usedRunIds.includes(String(r.id)),
      );
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  // ==================== 同步终态 ====================

  async sync(id: number) {
    const record = await this.recordRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`账本记录 ${id} 不存在`);
    }
    if (!record.runId) {
      throw new BadRequestException('该记录未关联 GitHub runId（dispatch 捕获失败），请改用 run 网页核对');
    }

    const resp = await axios.get(`${GH_API}/repos/${this.githubRepo}/actions/runs/${record.runId}`, {
      headers: { ...GH_HEADERS, Authorization: `Bearer ${this.githubToken()}` },
      timeout: 15000,
    });
    const run = resp.data || {};

    if (run.status !== 'completed') {
      return { synced: false, runStatus: run.status, record };
    }

    record.status = run.conclusion === 'success' ? 'success' : 'failure';
    record.finishedAt = new Date();
    record.runUrl = record.runUrl || run.html_url;

    if (record.status === 'success' && !record.version) {
      // dispatch 未显式指定版本时，从 ci/build-ledger 分支的 jsonl 反查（行内带 runId + version）
      const version = await this.lookupVersionFromLedger(record.runId).catch(() => null);
      if (version) {
        record.version = version;
        record.detail = `版本由账本 jsonl 反查回填: ${version}`;
      }
    }

    await this.recordRepo.save(record);

    if (record.status === 'success' && record.version) {
      await this.pointerRepo.upsert({ appId: record.appId, lastBuildVersion: record.version } as Partial<BuildPointer>, ['appId']);
    }

    return { synced: true, record };
  }

  /** 从 ci/build-ledger 分支的 .ci/build-ledger.jsonl 反查该 run 的版本号 */
  private async lookupVersionFromLedger(runId: string): Promise<string | null> {
    const resp = await axios.get(
      `${GH_API}/repos/${this.githubRepo}/contents/.ci/build-ledger.jsonl`,
      {
        headers: { ...GH_HEADERS, Authorization: `Bearer ${this.githubToken()}`, Accept: 'application/vnd.github.raw+json' },
        params: { ref: 'ci/build-ledger' },
        timeout: 15000,
      },
    );
    const lines = String(resp.data || '')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((l) => l && String(l.runId) === String(runId));

    const terminal = lines.find((l) => l.status === 'success' || l.status === 'failure');
    return terminal?.version || lines[0]?.version || null;
  }

  // ==================== promote / rollback ====================

  async promote(dto: PromoteDto, triggeredBy: string) {
    return this.publishToProd(dto.app, dto.version, 'promote', triggeredBy);
  }

  async rollback(dto: RollbackDto, triggeredBy: string) {
    return this.publishToProd(dto.app, dto.version, 'rollback', triggeredBy);
  }

  /** 把版本目录 copyObject 到生产根指针（promote 与 rollback 同机制，账本 kind 区分） */
  private async publishToProd(appId: string, version: string, kind: 'promote' | 'rollback', triggeredBy: string) {
    this.assertAllowedApp(appId);
    if (!VERSION_PATTERN.test(version)) {
      throw new BadRequestException(`非法版本号: ${version}`);
    }

    const { config, provider } = await this.deployProvider('listObjectKeys', 'copyObject');

    const srcPrefix = `${this.objectPrefix}/${appId}/${version}/`;
    const keys = await provider.listObjectKeys(srcPrefix);
    if (keys.length === 0) {
      throw new BadRequestException(`CDN 上未找到 ${srcPrefix} 下的对象（版本不存在？）`);
    }

    const startedAt = new Date();
    const failed: string[] = [];
    for (const key of keys) {
      const destKey = `${this.objectPrefix}/${appId}/${key.slice(srcPrefix.length)}`;
      try {
        await provider.copyObject(key, destKey);
      } catch (error) {
        this.logger.error(`copyObject 失败 ${key} → ${destKey}: ${error?.message}`);
        failed.push(key);
      }
    }
    if (failed.length > 0) {
      const detail = `promote 中断: ${failed.length}/${keys.length} 个对象复制失败（putObjectCopy 幂等，可直接重试）`;
      await this.recordRepo.save(
        this.recordRepo.create({
          appId,
          version,
          target: 'prod',
          kind,
          status: 'failure',
          triggeredBy: triggeredBy || null,
          startedAt,
          finishedAt: new Date(),
          detail,
        }),
      );
      throw new BadRequestException(`${detail}；生产指针未切换`);
    }

    await this.pointerRepo.upsert({ appId, prodVersion: version } as Partial<BuildPointer>, ['appId']);
    await this.recordRepo.save(
      this.recordRepo.create({
        appId,
        version,
        target: 'prod',
        kind,
        status: 'success',
        triggeredBy: triggeredBy || null,
        startedAt,
        finishedAt: new Date(),
        detail: `copyObject ${keys.length} 个对象 → ${this.objectPrefix}/${appId}/`,
      }),
    );

    const entryBase = config.domain || `https://${config.bucket}.cos.${config.region}.myqcloud.com`;
    return {
      success: true,
      kind,
      appId,
      version,
      promoted: keys.length,
      prodEntryUrl: `${entryBase}/${this.objectPrefix}/${appId}/index.html`,
    };
  }

  // ==================== 外部构建落账（单一账本） ====================

  /**
   * quick-upload 本地/应急链路的构建落账：与 CI 构建共用同一 MySQL 账本（kind=build）。
   * 单一账本原则——外部链路不再自持 ci/build-ledger jsonl；落账前校验版本目录真实存在，
   * 拒绝账本与 COS 漂移。灰度发布版本落这里之后自动进入 UI 回滚下拉（listVersions 以账本为准）。
   */
  async recordExternalDeploy(dto: RecordExternalDto, recordedBy: string) {
    this.assertAllowedApp(dto.app);
    if (!VERSION_PATTERN.test(dto.version)) {
      throw new BadRequestException(`非法版本号: ${dto.version}`);
    }
    const target = dto.target || 'gray';
    const { provider } = await this.deployProvider('listObjectKeys');
    const keys = await provider
      .listObjectKeys(`${this.objectPrefix}/${dto.app}/${dto.version}/`)
      .catch(() => [] as string[]);
    if (keys.length === 0) {
      throw new BadRequestException(
        `CDN 上未找到 ${this.objectPrefix}/${dto.app}/${dto.version}/ 下的对象，拒绝落账（账本必须与产物一致）`,
      );
    }
    // 幂等防重：同应用同版本的 success 构建只落一行，重复落账返回既有记录
    const existing = await this.recordRepo.findOne({
      where: { appId: dto.app, version: dto.version, kind: 'build', status: 'success' },
    });
    if (existing) {
      return { success: true, record: existing, objects: keys.length, deduplicated: true };
    }
    const record = await this.recordRepo.save(
      this.recordRepo.create({
        appId: dto.app,
        version: dto.version,
        target,
        kind: 'build',
        status: 'success',
        triggeredBy: recordedBy || null,
        startedAt: new Date(),
        finishedAt: new Date(),
        detail: `外部构建落账（quick-upload）：${keys.length} 个对象`,
      }),
    );
    await this.pointerRepo.upsert({ appId: dto.app, lastBuildVersion: dto.version } as Partial<BuildPointer>, ['appId']);
    return { success: true, record, objects: keys.length };
  }

  // ==================== 查询 ====================

  async listBuilds(query: QueryBuildsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const qb = this.recordRepo.createQueryBuilder('r').orderBy('r.id', 'DESC');
    if (query.appId) {
      qb.andWhere('r.appId = :appId', { appId: query.appId });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    const [items, total] = await qb
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async getBuild(id: number) {
    const record = await this.recordRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`账本记录 ${id} 不存在`);
    }
    return record;
  }

  /** 可回滚版本清单：该应用构建成功的去重版本（新→旧）；已被回收删除的版本不出现在下拉里 */
  async listVersions(appId: string) {
    this.assertAllowedApp(appId);
    const rows = await this.recordRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.version', 'version')
      .addSelect('MAX(r.id)', 'lastId')
      .where('r.appId = :appId', { appId })
      .andWhere('r.status = :status', { status: 'success' })
      .andWhere('r.version IS NOT NULL')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM build_center_cleanup c WHERE c.appId = :appId AND c.version = r.version AND c.status = 'deleted')`,
      )
      .setParameter('deletedStatus', 'deleted')
      .groupBy('r.version')
      .orderBy('lastId', 'DESC')
      .limit(30)
      .getRawMany();
    return { appId, versions: rows.map((r) => r.version) };
  }

  /** 全应用概览：生产指针 + 最近构建 + 灰度绑定人数 */
  async status() {
    const apps = this.allowedApps;
    const pointers = await this.pointerRepo.find();
    const pointerMap = new Map(pointers.map((p) => [p.appId, p]));

    return Promise.all(
      apps.map(async (appId) => {
        const lastBuild = await this.recordRepo.findOne({
          where: { appId, kind: 'build' },
          order: { id: 'DESC' },
        });
        let grayUsers = 0;
        try {
          const stats = await this.grayReleaseService.getVersionStats(appId);
          grayUsers = stats.totalUsers || 0;
        } catch {
          grayUsers = -1; // Redis 异常时不阻塞概览
        }
        const pointer = pointerMap.get(appId);
        return {
          appId,
          prodVersion: pointer?.prodVersion || null,
          lastBuildVersion: pointer?.lastBuildVersion || null,
          lastBuild: lastBuild
            ? { id: lastBuild.id, status: lastBuild.status, version: lastBuild.version, runUrl: lastBuild.runUrl, finishedAt: lastBuild.finishedAt }
            : null,
          grayUsers,
        };
      }),
    );
  }

  // ==================== 版本回收（扫描 → 人工审批 → 物理删除） ====================
  //
  // 保留策略（企业流水线 retention 语义，窗口天数 env 可调）：
  // - live 永不删：当前生产指针版本、灰度绑定中的版本
  // - 退役生产版本（曾是 prod、被新版本取代）：退役后 CLEANUP_ROLLBACK_DAYS（默认 14 天）可删
  // - 未上产 success 构建（实习生 CI 小改动场景）：候选期 CLEANUP_CANDIDATE_DAYS（默认 7 天）内
  //   随时可 promote 复用，过期未用即列为待批
  // - failure / 悬空 started：CLEANUP_FAILED_DAYS（默认 2 天）后列为待批
  // - 账本外目录（如手工放的 changelog）：status=review，永不自动删，人工确认后才可批
  //
  // 安全边界：
  // - 扫描只落 build_center_cleanup 计划表，**永不删除**
  // - 物理删除只能走 cleanupApprove（构建中心 UI 审批，需 CLEANUP_BUILD_CENTER_VERSION 权限码），
  //   审批时点重新校验生产指针与灰度绑定（扫描与审批之间状态可能变化）；灰度检查失败 = 拒绝删除（fail-closed）
  // - 删除范围物理限定在 www/micro/{app}/{version}/（含 index.html 的版本目录），桶根/业务前缀/生产根不可达
  // - 每次删除落账本 kind=cleanup，可审计

  private cleanupDays(envKey: string, def: number): number {
    const v = Number(process.env[envKey]);
    return Number.isFinite(v) && v > 0 ? v : def;
  }

  private get cleanupCandidateDays(): number {
    return this.cleanupDays('CLEANUP_CANDIDATE_DAYS', 7);
  }

  private get cleanupRollbackDays(): number {
    return this.cleanupDays('CLEANUP_ROLLBACK_DAYS', 14);
  }

  private get cleanupFailedDays(): number {
    return this.cleanupDays('CLEANUP_FAILED_DAYS', 2);
  }

  /** 定时扫描：默认每 24h 一次，启动 1 分钟后首扫；BUILD_CENTER_CLEANUP_AUTO=false 关闭 */
  onModuleInit() {
    if ((process.env.BUILD_CENTER_CLEANUP_AUTO || 'true') === 'false') return;
    const hours = this.cleanupDays('CLEANUP_SCAN_INTERVAL_HOURS', 24);
    const tick = async () => {
      try {
        const summary = await this.cleanupScan();
        this.logger.log(
          `版本回收定时扫描完成: 待批 ${summary.pending} / 人工确认 ${summary.review} / 保留 ${summary.protected}`,
        );
      } catch (error) {
        this.logger.warn(`版本回收定时扫描失败（不影响线上）: ${error?.message}`);
      }
    };
    setTimeout(() => void tick(), 60_000).unref?.();
    setInterval(() => void tick(), hours * 3_600_000).unref?.();
  }

  /**
   * 扫描全部注册应用的版本目录，产出回收计划（只落 build_center_cleanup 表，绝不删除）。
   * 版本目录判定：`{prefix}/{app}/<dir>/index.html` 存在（排除生产根直传文件与 assets/js 等子目录）。
   */
  async cleanupScan() {
    const { provider } = await this.deployProvider('listObjectStats');

    const pointers = await this.pointerRepo.find();
    const pointerMap = new Map(pointers.map((p) => [p.appId, p]));
    const scannedAt = new Date();
    const summary = { pending: 0, review: 0, protected: 0 };
    const dayMs = 86_400_000;
    const now = () => Date.now();

    for (const appId of this.allowedApps) {
      const appPrefix = `${this.objectPrefix}/${appId}/`;
      let objects: Array<{ key: string; size: number; lastModified: Date | null }>;
      try {
        objects = await provider.listObjectStats(appPrefix);
      } catch (error) {
        this.logger.warn(`[cleanup] 列举 ${appPrefix} 失败，跳过该应用: ${error?.message}`);
        continue;
      }

      // 按版本目录分组（第一段目录名），聚合对象数/体积/最新修改时间/index.html 存在性
      const groups = new Map<string, { objectCount: number; bytes: number; hasIndex: boolean; lastModified: Date | null }>();
      for (const o of objects) {
        const rel = o.key.slice(appPrefix.length);
        if (!rel) continue;
        const slash = rel.indexOf('/');
        if (slash < 0) continue; // 生产根直传文件，不属于版本管理
        const dir = rel.slice(0, slash);
        const rest = rel.slice(slash + 1);
        const g = groups.get(dir) || { objectCount: 0, bytes: 0, hasIndex: false, lastModified: null };
        g.objectCount += 1;
        g.bytes += o.size;
        if (o.lastModified && (!g.lastModified || o.lastModified > g.lastModified)) g.lastModified = o.lastModified;
        if (rest === 'index.html') g.hasIndex = true;
        groups.set(dir, g);
      }

      // 保护集：生产指针 + 灰度绑定（Redis 异常时不阻塞扫描，但该应用的绑定保护退化为空——
      // 审批时会再次 fail-closed 校验，所以扫描退化不影响最终安全）
      const prodVersion = pointerMap.get(appId)?.prodVersion || null;
      let grayBound = new Set<string>();
      try {
        grayBound = await this.grayBoundVersions(appId);
      } catch (error) {
        this.logger.warn(`[cleanup] ${appId} 灰度统计查询失败（扫描继续，审批时会 fail-closed 复核）: ${error?.message}`);
      }

      // 账本按版本聚合：是否上产过 / 最近成功时间 / 最新记录
      const records = await this.recordRepo.find({ where: { appId }, order: { id: 'DESC' } });
      const ledger = new Map<string, { everProd: boolean; lastProdAt: Date | null; lastSuccessAt: Date | null; latest: BuildRecord }>();
      for (const r of records) {
        if (!r.version) continue;
        let info = ledger.get(r.version);
        if (!info) {
          info = { everProd: false, lastProdAt: null, lastSuccessAt: null, latest: r };
          ledger.set(r.version, info);
        }
        if (r.target === 'prod' && r.status === 'success') {
          info.everProd = true;
          const at = r.finishedAt || r.createdAt;
          if (!info.lastProdAt || at > info.lastProdAt) info.lastProdAt = at;
        }
        if (r.status === 'success' && !info.lastSuccessAt) info.lastSuccessAt = r.finishedAt || r.createdAt;
      }

      for (const [version, g] of groups) {
        if (!g.hasIndex) continue; // 生产根子目录（assets/js 等），不属于版本管理
        const info = ledger.get(version) || null;
        let status: string;
        let reason: string;
        if (version === prodVersion) {
          status = 'protected';
          reason = '当前生产指针';
        } else if (grayBound.has(version)) {
          status = 'protected';
          reason = '灰度绑定中（删除会导致绑定用户 404）';
        } else if (info?.everProd) {
          const ageDays = Math.floor((now() - (info.lastProdAt?.getTime() || now())) / dayMs);
          if (ageDays >= this.cleanupRollbackDays) {
            status = 'pending';
            reason = `退役生产版本，已过 ${this.cleanupRollbackDays} 天回滚窗口`;
          } else {
            status = 'protected';
            reason = `回滚窗口内（退役 ${ageDays}/${this.cleanupRollbackDays} 天）`;
          }
        } else if (info?.lastSuccessAt) {
          const ageDays = Math.floor((now() - info.lastSuccessAt.getTime()) / dayMs);
          if (ageDays >= this.cleanupCandidateDays) {
            status = 'pending';
            reason = `未上产构建，超过 ${this.cleanupCandidateDays} 天候选期`;
          } else {
            status = 'protected';
            reason = `候选保留中（${ageDays}/${this.cleanupCandidateDays} 天，promote 后转生产保护）`;
          }
        } else if (info) {
          const at = info.latest.finishedAt || info.latest.createdAt;
          const ageDays = Math.floor((now() - (at ? at.getTime() : now())) / dayMs);
          if (ageDays >= this.cleanupFailedDays) {
            status = 'pending';
            reason = `失败/悬账构建，超过 ${this.cleanupFailedDays} 天`;
          } else {
            status = 'protected';
            reason = `失败/悬账构建，${this.cleanupFailedDays} 天窗口内`;
          }
        } else {
          status = 'review';
          const ageDays = g.lastModified ? Math.floor((now() - g.lastModified.getTime()) / dayMs) : null;
          reason = `账本外目录（非构建产物？${ageDays != null ? `最后修改 ${ageDays} 天前` : '时间未知'}），人工确认后可删`;
        }

        await this.cleanupRepo.upsert(
          { appId, version, status, reason, objectCount: g.objectCount, bytes: g.bytes, scannedAt } as Partial<BuildCleanup>,
          ['appId', 'version'],
        );
        if (status === 'pending' || status === 'review' || status === 'protected') {
          summary[status as 'pending' | 'review' | 'protected']++;
        }
      }

      // 上次 pending 但本次 COS 上已消失的目录 → missing（可能被控制台手动删过）
      const existing = await this.cleanupRepo.find({ where: { appId } });
      for (const row of existing) {
        if (row.status === 'pending' && !groups.has(row.version)) {
          row.status = 'missing';
          row.detail = `${row.detail ? row.detail + '\n' : ''}扫描时目录已不存在`;
          await this.cleanupRepo.save(row);
        }
      }
    }
    return summary;
  }

  /** 回收计划视图：待批 / 人工确认 / 保护中 / 最近已清理 */
  async cleanupPlan() {
    const rows = await this.cleanupRepo.find({ order: { updatedAt: 'DESC' } });
    const pick = (status: string) => rows.filter((r) => r.status === status);
    return {
      scannedAt: rows.length ? rows.map((r) => r.scannedAt).sort().pop() : null,
      pending: pick('pending'),
      review: pick('review'),
      protected: pick('protected'),
      missing: pick('missing').slice(0, 50),
      recentDeleted: pick('deleted').slice(0, 50),
    };
  }

  /**
   * 人工审批：立即物理删除选中版本目录（仅接受 pending / review 两类）。
   * 审批时点 fail-closed 复核：是当前生产指针 → 拒绝；灰度绑定中 → 拒绝；灰度查询失败 → 拒绝。
   * 逐对象删除，全部成功才记 deleted；部分失败保持原状态可重批（删除幂等）。
   */
  async cleanupApprove(ids: number[], decidedBy: string) {
    const rows = await this.cleanupRepo.find({ where: { id: In(ids) } });
    const approved = rows.filter((r) => r.status === 'pending' || r.status === 'review');
    if (approved.length === 0) {
      throw new BadRequestException('选中记录中没有可审批的待清理/人工确认项（可能已被处理）');
    }

    const { provider } = await this.deployProvider('listObjectKeys', 'deleteObject');

    const results: Array<{ id: number; appId: string; version: string; ok: boolean; deletedObjects?: number; detail: string }> = [];
    for (const row of approved) {
      // 审批时点 fail-closed 复核（扫描到审批之间状态可能变化）
      const pointer = await this.pointerRepo.findOne({ where: { appId: row.appId } });
      if (pointer?.prodVersion === row.version) {
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: false, detail: '批准时已是当前生产版本，拒绝删除' });
        continue;
      }
      let boundVersions: Set<string>;
      try {
        boundVersions = await this.grayBoundVersions(row.appId);
      } catch (error) {
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: false, detail: `灰度绑定检查失败，拒绝删除（fail-closed）: ${error?.message}` });
        continue;
      }
      if (boundVersions.has(row.version)) {
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: false, detail: '批准时已存在灰度绑定，拒绝删除' });
        continue;
      }

      const versionDir = `${this.objectPrefix}/${row.appId}/${row.version}/`;
      let keys: string[];
      try {
        keys = await provider.listObjectKeys(versionDir);
      } catch (error) {
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: false, detail: `列举版本目录失败: ${error?.message}` });
        continue;
      }
      if (keys.length === 0) {
        row.status = 'missing';
        row.decidedBy = decidedBy;
        row.decidedAt = new Date();
        row.detail = `${row.detail ? row.detail + '\n' : ''}审批时目录已不存在`.trim();
        await this.cleanupRepo.save(row);
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: true, deletedObjects: 0, detail: '目录已不存在，标记 missing' });
        continue;
      }

      const startedAt = new Date();
      let deleted = 0;
      const failed: string[] = [];
      for (const key of keys) {
        try {
          await provider.deleteObject(key);
          deleted += 1;
        } catch (error) {
          this.logger.error(`[cleanup] 删除失败 ${key}: ${error?.message}`);
          failed.push(key);
        }
      }

      if (failed.length > 0) {
        row.detail = `${row.detail ? row.detail + '\n' : ''}清理中断: ${failed.length}/${keys.length} 个对象删除失败（幂等，可重新审批续删）`;
        await this.cleanupRepo.save(row);
        await this.recordRepo.save(
          this.recordRepo.create({
            appId: row.appId,
            version: row.version,
            target: 'prod',
            kind: 'cleanup',
            status: 'failure',
            triggeredBy: decidedBy || null,
            startedAt,
            finishedAt: new Date(),
            detail: `版本回收中断: ${failed.length}/${keys.length} 个对象删除失败`,
          }),
        );
        results.push({ id: row.id, appId: row.appId, version: row.version, ok: false, deletedObjects: deleted, detail: `清理中断，${failed.length} 个对象删除失败（可重批续删）` });
        continue;
      }

      row.status = 'deleted';
      row.deletedObjects = deleted;
      row.decidedBy = decidedBy || null;
      row.decidedAt = new Date();
      row.detail = `人工审批清理 ${deleted} 个对象（${(row.bytes / 1024 / 1024).toFixed(2)} MB）`;
      await this.cleanupRepo.save(row);
      await this.recordRepo.save(
        this.recordRepo.create({
          appId: row.appId,
          version: row.version,
          target: 'prod',
          kind: 'cleanup',
          status: 'success',
          triggeredBy: decidedBy || null,
          startedAt,
          finishedAt: new Date(),
          detail: `人工审批清理版本目录 ${versionDir}：${deleted} 个对象`,
        }),
      );
      results.push({ id: row.id, appId: row.appId, version: row.version, ok: true, deletedObjects: deleted, detail: `已删除 ${deleted} 个对象` });
    }

    return {
      success: results.every((r) => r.ok),
      results,
      totalDeleted: results.reduce((sum, r) => sum + (r.deletedObjects || 0), 0),
    };
  }
}
