/**
 * 灰度发布 DTO
 * website: https://www.roginx.ink
 */

import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, Min } from 'class-validator';

/**
 * 创建灰度白名单绑定 DTO
 */
export class CreateGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ttl?: number; // 过期时间（秒），0 表示不过期
}

/**
 * 批量绑定灰度白名单 DTO
 */
export class BatchBindGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  userIds: string[];

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ttl?: number; // 过期时间（秒），0 表示不过期
}

/**
 * 删除灰度白名单 DTO
 */
export class DeleteGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

/**
 * 批量删除灰度白名单 DTO
 */
export class BatchDeleteGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  userIds: string[];
}

/**
 * 查询灰度白名单 DTO
 */
export class QueryGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

/**
 * 更新灰度白名单 DTO
 */
export class UpdateGrayReleaseDto {
  @IsString()
  @IsNotEmpty()
  appId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ttl?: number; // 过期时间（秒），0 表示不过期
}

