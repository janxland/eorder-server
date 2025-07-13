import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * AI模型服务类型枚举
 */
export enum AIModelType {
  OPENAI = 'openai',
  AZURE = 'azure',
  ANTHROPIC = 'anthropic',
  BAIDU = 'baidu',
  XFYUN = 'xfyun',
  ZHIPU = 'zhipu',
  SILICON_FLOW = 'silicon_flow', // 添加硅基流动类型
  OTHER = 'other',
}

/**
 * AI模型配置实体
 */
@Entity('ai_model_config')
export class AIModelConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: AIModelType,
    default: AIModelType.OPENAI,
  })
  type: AIModelType;

  @Column({ length: 255 })
  apiKey: string;

  @Column({ length: 255, nullable: true })
  apiSecret: string;

  @Column({ length: 255, nullable: true })
  orgId: string;

  @Column({ length: 255 })
  baseUrl: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ type: 'int', default: 0 })
  maxTokens: number;

  @Column({ type: 'float', default: 0.7 })
  temperature: number;

  @Column({ type: 'float', default: 0 })
  topP: number;

  @Column({ type: 'int', default: 0 })
  timeout: number;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'json', nullable: true })
  extraConfig: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'float', default: 0 })
  totalTokens: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 