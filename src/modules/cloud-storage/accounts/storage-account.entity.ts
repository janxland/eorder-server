import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { StorageConfig } from '../entities/storage-config.entity';

/**
 * 云存储账号（永久密钥加密存储）
 * 一个账号 = 一套永久密钥，被多个 profile 配置引用 → 解决"项目多配置不过来"
 */
@Entity('storage_accounts')
export class StorageAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ['cos', 'oss', 'qiniu'], default: 'cos' })
  provider: 'cos' | 'oss' | 'qiniu';

  /** AES-256-GCM 密文（accessKey） */
  @Column({ type: 'blob', nullable: false, select: false })
  accessKeyEnc: Buffer;

  /** AES-256-GCM 密文（secretKey） */
  @Column({ type: 'blob', nullable: false, select: false })
  secretKeyEnc: Buffer;

  @Column({ length: 255, nullable: true })
  remark: string;

  @OneToMany(() => StorageConfig, (config) => config.account)
  configs: StorageConfig[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
