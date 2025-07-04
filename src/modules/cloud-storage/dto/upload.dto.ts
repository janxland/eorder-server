import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { StorageProviderType } from '../entities/storage-config.entity';

/**
 * 获取上传凭证DTO
 */
export class GetUploadTokenDto {
  @IsNotEmpty({ message: '存储提供商类型不能为空' })
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider: StorageProviderType;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsNumber()
  expires?: number;
  
  @IsOptional()
  @IsNumber()
  configId?: number;
}

/**
 * 获取上传URL DTO
 */
export class GetUploadUrlDto {
  @IsNotEmpty({ message: '存储提供商类型不能为空' })
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider: StorageProviderType;

  @IsNotEmpty({ message: '文件键值不能为空' })
  @IsString()
  key: string;

  @IsOptional()
  @IsNumber()
  expires?: number;
  
  @IsOptional()
  @IsNumber()
  configId?: number;
}

/**
 * 获取文件URL DTO
 */
export class GetFileUrlDto {
  @IsNotEmpty({ message: '存储提供商类型不能为空' })
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider: StorageProviderType;

  @IsNotEmpty({ message: '文件键值不能为空' })
  @IsString()
  key: string;

  @IsOptional()
  @IsNumber()
  expires?: number;
  
  @IsOptional()
  @IsNumber()
  configId?: number;
}

/**
 * 上传文件元数据DTO
 */
export class FileMetadataDto {
  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

/**
 * 删除文件DTO
 */
export class DeleteFileDto {
  @IsNotEmpty({ message: '存储提供商类型不能为空' })
  @IsEnum(StorageProviderType, { message: '无效的存储提供商类型' })
  provider: StorageProviderType;

  @IsNotEmpty({ message: '文件键值不能为空' })
  @IsString()
  key: string;
  
  @IsOptional()
  @IsNumber()
  configId?: number;
} 