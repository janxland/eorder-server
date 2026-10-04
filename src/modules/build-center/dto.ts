/**
 * 构建中心 DTO
 * website: https://www.roginx.ink
 */

import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsNumber, ArrayMinSize, ArrayMaxSize, Matches } from 'class-validator';

/** 版本号口径与 monorepo build-deploy.yml 一致：字母/数字开头，[A-Za-z0-9._-]，≤64 字符 */
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * 触发构建 DTO
 */
export class TriggerBuildDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  apps: string[];

  @IsOptional()
  @Matches(VERSION_PATTERN)
  version?: string;

  /** 本期仅支持 gray；prod 转全量走 /build-center/promote */
  @IsOptional()
  @IsIn(['gray'])
  target?: 'gray';
}

/**
 * promote（灰度转全量）DTO
 */
export class PromoteDto {
  @IsString()
  @IsNotEmpty()
  app: string;

  @Matches(VERSION_PATTERN)
  version: string;
}

/**
 * 生产回滚 DTO（机制同 promote：把旧版本 copyObject 回根指针，零删除保证旧版本永在）
 */
export class RollbackDto {
  @IsString()
  @IsNotEmpty()
  app: string;

  @Matches(VERSION_PATTERN)
  version: string;
}

/**
 * 账本查询 DTO（分页参数在 service 内做数字收敛，避免依赖全局 ValidationPipe transform）
 */
export class QueryBuildsDto {
  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsIn(['started', 'success', 'failure'])
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

/**
 * 外部构建落账 DTO（quick-upload 本地链路；版本目录必须已真实存在于 COS）
 */
export class RecordExternalDto {
  @IsString()
  @IsNotEmpty()
  app: string;

  @Matches(VERSION_PATTERN)
  version: string;

  @IsOptional()
  @IsIn(['gray', 'prod'])
  target?: 'gray' | 'prod';
}

/**
 * 版本回收审批 DTO：批准删除扫描出的待清理版本目录（立即执行物理删除）
 */
export class ApproveCleanupDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  ids: number[];
}
