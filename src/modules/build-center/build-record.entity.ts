import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 构建中心 · 发版账本（MySQL 正式账本，取代 ci/build-ledger 分支的 jsonl 雏形）
 * - kind=build 的行由 trigger API 创建，status 从 started 经 sync 收敛到 success/failure
 * - kind=promote/rollback 的行由控制面直接落终态（同步操作，无中间态）
 */
@Entity('build_center_record')
export class BuildRecord {
  @PrimaryGeneratedColumn()
  id: number;

  /** 应用 ID（须在 monorepo scripts/build-center/apps.json 注册） */
  @Index()
  @Column({ length: 64 })
  appId: string;

  /** 版本号；dispatch 未指定时由 sync 从账本 jsonl 反查回填 */
  @Column({ length: 64, nullable: true })
  version: string;

  /** 目标环境：gray=版本化灰度目录；prod 仅用于 promote/rollback 记录 */
  @Column({ length: 16, default: 'gray' })
  target: string;

  /** 记录类型：build=构建 / promote=灰度转全量 / rollback=生产回滚 */
  @Column({ length: 16, default: 'build' })
  kind: string;

  /** 状态：started / success / failure */
  @Index()
  @Column({ length: 16, default: 'started' })
  status: string;

  /** 触发时仓库 commit 短 SHA（可空） */
  @Column({ length: 40, nullable: true })
  commitSha: string;

  /** GitHub Actions run id（varchar 存储，规避 bigint 驱动返回 string 的口径混乱） */
  @Index()
  @Column({ length: 20, nullable: true })
  runId: string;

  /** GitHub Actions run 页面 URL */
  @Column({ length: 255, nullable: true })
  runUrl: string;

  /** 触发者（用户名或用户 ID） */
  @Column({ length: 64, nullable: true })
  triggeredBy: string;

  /** 详情：复制对象数 / 失败原因 / 反查到的版本等 */
  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
