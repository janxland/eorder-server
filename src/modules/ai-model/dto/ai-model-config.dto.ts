import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, ValidateNested, IsObject } from 'class-validator';
import { AIModelType } from '../entities/ai-model-config.entity';

export class CreateAIModelConfigDto {
  @IsString()
  name: string;

  @IsEnum(AIModelType)
  type: AIModelType;

  @IsString()
  apiKey: string;

  @IsString()
  @IsOptional()
  apiSecret?: string;

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  baseUrl: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  topP?: number;

  @IsNumber()
  @IsOptional()
  timeout?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsObject()
  @IsOptional()
  extraConfig?: Record<string, any>;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateAIModelConfigDto extends CreateAIModelConfigDto {
  @IsNumber()
  @IsOptional()
  usageCount?: number;

  @IsNumber()
  @IsOptional()
  totalTokens?: number;
}

export class TestAIModelConfigDto extends CreateAIModelConfigDto {
  @IsString()
  @IsOptional()
  testPrompt?: string;
} 