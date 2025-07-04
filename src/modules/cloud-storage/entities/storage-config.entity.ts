import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 云存储服务类型枚举
 */
export enum StorageProviderType {
  QINIU = 'qiniu',
  COS = 'cos',
  OSS = 'oss',
}

/**
 * 云存储配置实体
 */
@Entity('cloud_storage_config')
export class StorageConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, comment: '配置名称' })
  name: string;

  @Column({
    type: 'enum',
    enum: StorageProviderType,
    comment: '存储提供商类型',
  })
  provider: StorageProviderType;

  @Column({ length: 100, comment: '访问密钥ID' })
  accessKeyId: string;

  @Column({ length: 100, comment: '访问密钥Secret' })
  accessKeySecret: string;

  @Column({ length: 100, comment: '存储桶名称' })
  bucket: string;

  @Column({ length: 255, comment: '区域/地域', nullable: true })
  region: string;

  @Column({ length: 255, comment: '自定义域名', nullable: true })
  domain: string;

  @Column({ length: 255, comment: '存储桶访问路径', nullable: true })
  endpoint: string;

  @Column({ comment: '是否为默认配置', default: false })
  isDefault: boolean;

  @Column({ comment: '是否启用', default: true })
  isEnabled: boolean;

  @Column({ type: 'json', comment: '额外配置', nullable: true })
  extraConfig: Record<string, any>;

  @Column({ length: 255, comment: '备注', nullable: true })
  remark: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
} 