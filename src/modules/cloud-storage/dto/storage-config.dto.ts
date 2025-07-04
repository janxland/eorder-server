import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { StorageProviderType } from '../entities/storage-config.entity';

/**
 * 创建云存储配置DTO
 */
export class CreateStorageConfigDto {
  @IsNotEmpty({ message: '配置名称不能为空' })
  @IsString()
  @MaxLength(50, { message: '配置名称长度不能超过50个字符' })
  name: string;

  @IsNotEmpty({ message: '存储提供商类型不能为空' })
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider: StorageProviderType;

  @IsNotEmpty({ message: '访问密钥ID不能为空' })
  @IsString()
  @MaxLength(100, { message: '访问密钥ID长度不能超过100个字符' })
  accessKeyId: string;

  @IsNotEmpty({ message: '访问密钥Secret不能为空' })
  @IsString()
  @MaxLength(100, { message: '访问密钥Secret长度不能超过100个字符' })
  accessKeySecret: string;

  @IsNotEmpty({ message: '存储桶名称不能为空' })
  @IsString()
  @MaxLength(100, { message: '存储桶名称长度不能超过100个字符' })
  bucket: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '区域/地域长度不能超过255个字符' })
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '自定义域名长度不能超过255个字符' })
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '存储桶访问路径长度不能超过255个字符' })
  endpoint?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '备注长度不能超过255个字符' })
  remark?: string;
}

/**
 * 更新云存储配置DTO
 */
export class UpdateStorageConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '配置名称长度不能超过50个字符' })
  name?: string;

  @IsOptional()
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider?: StorageProviderType;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '访问密钥ID长度不能超过100个字符' })
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '访问密钥Secret长度不能超过100个字符' })
  accessKeySecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '存储桶名称长度不能超过100个字符' })
  bucket?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '区域/地域长度不能超过255个字符' })
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '自定义域名长度不能超过255个字符' })
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '存储桶访问路径长度不能超过255个字符' })
  endpoint?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  extraConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '备注长度不能超过255个字符' })
  remark?: string;
}

/**
 * 测试云存储配置连接DTO
 */
export class TestStorageConfigDto extends CreateStorageConfigDto {} 