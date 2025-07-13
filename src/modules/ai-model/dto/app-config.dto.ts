import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsObject, IsNumber } from 'class-validator';
import { AppType } from '../entities/app-config.entity';

export class CreateAppConfigDto {
  @IsString()
  name: string;

  @IsEnum(AppType)
  type: AppType;

  @IsString()
  @IsOptional()
  selector?: string;

  @IsArray()
  messages: any[];

  @IsObject()
  @IsOptional()
  extraConfig?: Record<string, any>;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
  
  @IsNumber()
  @IsOptional()
  aiModelConfigId?: number;
}

export class UpdateAppConfigDto extends CreateAppConfigDto {}

export class SearchAppConfigDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(AppType)
  @IsOptional()
  type?: AppType;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
  
  @IsNumber()
  @IsOptional()
  aiModelConfigId?: number;
} 