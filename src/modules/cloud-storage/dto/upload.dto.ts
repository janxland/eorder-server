import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { StorageType } from '../entities/storage-config.entity';

/**
 * 获取上传凭证DTO
 */
export class GetUploadTokenDto {
  @IsNotEmpty({ message: '存储类型不能为空' })
  @IsEnum(StorageType)
  provider: StorageType;

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
  @IsNotEmpty({ message: '存储类型不能为空' })
  @IsEnum(StorageType)
  provider: StorageType;

  @IsNotEmpty({ message: '文件路径不能为空' })
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
  @IsNotEmpty({ message: '存储类型不能为空' })
  @IsEnum(StorageType)
  provider: StorageType;

  @IsNotEmpty({ message: '文件路径不能为空' })
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
  @IsNotEmpty({ message: '存储类型不能为空' })
  @IsEnum(StorageType)
  provider: StorageType;

  @IsNotEmpty({ message: '文件路径不能为空' })
  @IsString()
  key: string;
  
  @IsOptional()
  @IsNumber()
  configId?: number;
} 