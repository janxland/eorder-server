import { Entity, Column, UpdateDateColumn } from 'typeorm';

/**
 * 构建中心 · 应用版本指针（每应用一行）
 * - prodVersion：当前生产指针（www/micro/{app}/ 根路径实际服务的版本，promote/rollback 时切换）
 * - lastBuildVersion：最近一次构建成功的版本（sync 收敛时回填）
 * 旧版本目录因「零删除、零覆盖」永远在 CDN 上，回滚 = 把指针切回旧版本。
 */
@Entity('build_center_pointer')
export class BuildPointer {
  /** 应用 ID（自然主键） */
  @Column({ length: 64, primary: true })
  appId: string;

  @Column({ length: 64, nullable: true })
  prodVersion: string;

  @Column({ length: 64, nullable: true })
  lastBuildVersion: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
