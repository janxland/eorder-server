import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AIModelConfig } from './ai-model-config.entity';

/**
 * 应用配置类型枚举
 */
export enum AppType {
  BROWSER_EXTENSION = 'browser_extension',
  WEB_APP = 'web_app',
  MOBILE_APP = 'mobile_app',
  SCRIPT = 'script',
  OTHER = 'other',
}

/**
 * 应用配置实体
 */
@Entity('app_config')
export class AppConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: AppType,
    default: AppType.WEB_APP,
  })
  type: AppType;

  @Column({ length: 255, nullable: true })
  selector: string;

  @Column({ type: 'json' })
  messages: any[];

  @Column({ type: 'json', nullable: true })
  extraConfig: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  isDefault: boolean;
  
  @Column({ nullable: true })
  aiModelConfigId: number;
  
  @ManyToOne(() => AIModelConfig, { nullable: true })
  @JoinColumn({ name: 'aiModelConfigId' })
  aiModelConfig: AIModelConfig;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 