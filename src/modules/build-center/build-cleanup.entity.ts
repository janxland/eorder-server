import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 构建中心 · 版本回收计划（MySQL）
 *
 * 每次扫描（定时 + 手动）把 COS 上识别到的版本目录分类落库，但**扫描永不删除**：
 * - pending   可删待批：满足保留策略过期条件，等人在构建中心 UI 审批
 * - review    人工确认：账本外目录（如手工放的 changelog），确认无用后也可人工批准删除
 * - protected 保留中：生产指针 / 灰度绑定 / 回滚窗口 / 候选期内
 * - deleted   已清理：审批后物理删除完成（COS 对象已删，本行即归档记录）
 * - missing   目录已消失：上次 pending 但本次扫描 COS 上已不存在
 *
 * 删除只能由 cleanupApprove 触发（人工审批，走服务端长期密钥），账本落 kind=cleanup。
 */
@Entity('build_center_cleanup')
@Index('UQ_cleanup_app_version', ['appId', 'version'], { unique: true })
export class BuildCleanup {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 64 })
  appId: string;

  /** 版本目录名（www/micro/{app}/{version}/ 的一段） */
  @Column({ length: 64 })
  version: string;

  /** pending / review / protected / deleted / missing */
  @Index()
  @Column({ length: 16, default: 'pending' })
  status: string;

  /** 版本目录内对象数 */
  @Column({ type: 'int', default: 0 })
  objectCount: number;

  /** 版本目录总体积（字节） */
  @Column({ type: 'int', default: 0 })
  bytes: number;

  /** 分类原因（给人看）：如「未上产构建，超过 7 天候选期」/「当前生产指针」 */
  @Column({ length: 255, nullable: true })
  reason: string;

  /** 备注：审批记录 / 中断原因 / 目录年龄等 */
  @Column({ type: 'text', nullable: true })
  detail: string;

  /** 实际删除的对象数 */
  @Column({ type: 'int', nullable: true })
  deletedObjects: number;

  /** 审批人 */
  @Column({ length: 64, nullable: true })
  decidedBy: string;

  @Column({ type: 'datetime', nullable: true })
  decidedAt: Date;

  @Column({ type: 'datetime' })
  scannedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
