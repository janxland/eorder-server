/**
 * 构建中心服务
 * website: https://www.roginx.ink
 *
 * 职责（与 monorepo scripts/build-center 的 GitHub Actions 链路对接）：
 * 1. 触发构建 —— 包装 GitHub workflow_dispatch，落 MySQL 账本（started）
 * 2. 同步状态 —— 拉取 Actions run 终态收敛账本；成功时从账本 jsonl 反查版本号并回填指针
 * 3. promote  —— 把灰度版本目录 copyObject 到生产根指针（零删除、零覆盖版本目录）
 * 4. rollback —— 把旧版本 copyObject 回生产根指针（机制同 promote，账本记 rollback）
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { BuildRecord } from './build-record.entity';
import { BuildPointer } from './build-pointer.entity';
import { StorageConfig } from '@/modules/cloud-storage/entities/storage-config.entity';
import { CloudStorageFactory } from '@/modules/cloud-storage/providers/cloud-storage.factory';
import { GrayReleaseService } from '@/modules/gray-release/gray-release.service';
import { TriggerBuildDto, PromoteDto, RollbackDto, QueryBuildsDto, VERSION_PATTERN } from './dto';

const GH_API = 'https://api.github.com';
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

@Injectable()
export class BuildCenterService {
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
      await this.upsertPointer(record.appId, { lastBuildVersion: record.version });
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

    const config = await this.storageConfigRepo.findOne({
      where: { name: this.storageConfigName, isEnabled: true },
    });
    if (!config) {
      throw new BadRequestException(`未找到存储配置「${this.storageConfigName}」`);
    }
    const provider: any = await this.cloudStorageFactory.create(config);
    if (typeof provider.listObjectKeys !== 'function' || typeof provider.copyObject !== 'function') {
      throw new BadRequestException(`存储类型 ${config.type} 不支持 promote（当前仅实现 COS）`);
    }

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

    await this.upsertPointer(appId, { prodVersion: version });
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

  /** 可回滚版本清单：该应用构建成功的去重版本（新→旧） */
  async listVersions(appId: string) {
    this.assertAllowedApp(appId);
    const rows = await this.recordRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.version', 'version')
      .addSelect('MAX(r.id)', 'lastId')
      .where('r.appId = :appId', { appId })
      .andWhere('r.status = :status', { status: 'success' })
      .andWhere('r.version IS NOT NULL')
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

  private async upsertPointer(appId: string, patch: Partial<BuildPointer>) {
    let pointer = await this.pointerRepo.findOne({ where: { appId } });
    if (!pointer) {
      pointer = this.pointerRepo.create({ appId, ...patch });
    } else {
      Object.assign(pointer, patch);
    }
    return this.pointerRepo.save(pointer);
  }
}
