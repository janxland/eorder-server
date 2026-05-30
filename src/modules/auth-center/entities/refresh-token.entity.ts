import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/user.entity';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  token: string;

  /**
   * 会话标识：用于多端会话隔离
   * 一次登录 → 一个 sessionId → 一对 access/refresh token
   */
  @Index({ unique: true })
  @Column({ length: 64, nullable: true })
  sessionId: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Index()
  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  ipAddress: string;

  /** 解析后的设备友好名（如：Chrome on Windows） */
  @Column({ length: 128, nullable: true })
  deviceName: string;

  /** 最近活跃时间（刷新 token / 业务请求时更新） */
  @Column({ type: 'datetime', nullable: true })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}