import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { StorageType } from '../entities/storage-config.entity';

/**
 * 创建云存储配置DTO
 */
export class CreateStorageConfigDto {
  @IsNotEmpty({ message: '配置名称不能为空' })
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNotEmpty({ message: '存储类型不能为空' })
  @IsEnum(StorageType)
  type: StorageType;

  @IsNotEmpty({ message: '区域不能为空' })
  @IsString()
  @MaxLength(255)
  region: string;

  @IsNotEmpty({ message: '存储桶名称不能为空' })
  @IsString()
  @MaxLength(255)
  bucket: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  prefix?: string;

  @IsNotEmpty({ message: 'AccessKey不能为空' })
  @IsString()
  @MaxLength(255)
  accessKey: string;

  @IsNotEmpty({ message: 'SecretKey不能为空' })
  @IsString()
  @MaxLength(255)
  secretKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  endpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cdnDomain?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, any>;
}

/**
 * 更新云存储配置DTO
 */
export class UpdateStorageConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  prefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  accessKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secretKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  endpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cdnDomain?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, any>;
}

/**
 * 测试云存储配置连接DTO
 */
export class TestStorageConfigDto extends CreateStorageConfigDto {} 

export class UploadDto {
  @IsNotEmpty({ message: '文件路径不能为空' })
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  configId?: number;
  
  @IsOptional()
  @IsString()
  configName?: string;
} 