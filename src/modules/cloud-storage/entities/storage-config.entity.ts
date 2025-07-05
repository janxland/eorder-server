import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ length: 255 })
  region: string;

  @Column({ length: 255 })
  bucket: string;

  @Column({ length: 255, nullable: true })
  prefix: string;

  @Column({ length: 255 })
  accessKey: string;

  @Column({ length: 255 })
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