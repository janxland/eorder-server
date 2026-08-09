import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { StorageAccount } from '../accounts/storage-account.entity';

/**
 * 云存储服务类型枚举
 */
export enum StorageType {
  COS = 'cos',
  OSS = 'oss',
  QINIU = 'qiniu',
}

/**
 * 云存储配置实体
 * 新设计：密钥不再直接存本表，通过 accountId 引用 storage_accounts（密钥加密存储）
 * 旧字段 accessKey/secretKey 保留以兼容历史数据（迁移后置空）
 */
@Entity('storage_config')
export class StorageConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: StorageType,
    default: StorageType.COS,
  })
  type: StorageType;

  /** 引用云存储账号（密钥加密存储） */
  @Index()
  @Column({ nullable: true })
  accountId: number;

  @ManyToOne(() => StorageAccount, (account) => account.configs, { nullable: true })
  @JoinColumn({ name: 'accountId' })
  account: StorageAccount;

  @Column({ length: 255 })
  region: string;

  @Column({ length: 255 })
  bucket: string;

  @Column({ length: 255, nullable: true })
  prefix: string;

  /** 旧字段：历史数据兼容，新配置不再使用（迁移后可为空） */
  @Column({ length: 255, nullable: true, select: false })
  accessKey: string;

  /** 旧字段：历史数据兼容，新配置不再使用（迁移后可为空） */
  @Column({ length: 255, nullable: true, select: false })
  secretKey: string;

  @Column({ length: 255, nullable: true })
  endpoint: string;

  @Column({ length: 255, nullable: true })
  domain: string;

  @Column({ length: 255, nullable: true, comment: '源站CDN域名，例如：https://bucket-id.cos.region.myqcloud.com' })
  cdnDomain: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ type: 'json', nullable: true })
  extraConfig: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}