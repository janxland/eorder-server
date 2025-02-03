import { 
  IsString, 
  IsOptional, 
  IsNotEmpty, 
  IsNumber,
} from 'class-validator';
import { Exclude } from 'class-transformer';

/**
 * 创建资源 DTO
 */
export class CreateResourceDto {
  @IsNotEmpty({ message: 'fileName 不能为空' })
  @IsString()
  fileName: string; // 文件名

  @IsOptional()
  @IsString()
  filePath?: string; // 文件存储路径

  @IsOptional()
  @IsString()
  url?: string; // 网络资源 URL

  @IsNotEmpty({ message: 'resourceType 不能为空' })
  @IsString()
  resourceType: string; // 资源类型

  @IsOptional()
  @IsString()
  description?: string; // 资源描述

  @IsOptional()
  @IsString()
  md5?: string; // 文件 MD5

  @IsOptional()
  @IsNumber()
  userId?: number; // 如果前端以数值形式传 userId，可以这样定义
}

/**
 * 获取资源 DTO
 * 一般用于列表查询或单条查询时做参数过滤
 */
export class GetResourceDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  // 你可以根据需要增加分页、排序等字段
  // @IsOptional()
  // @IsNumber()
  // page?: number;

  // @IsOptional()
  // @IsNumber()
  // limit?: number;
}

/**
 * 更新资源 DTO
 * 通常做部分更新，因此所有字段都可选
 */
export class UpdateResourceDto {
  // 如果更新时一定要传 ID，可以单独在路由参数里获取
  // 或者在此处声明：
  // @IsNotEmpty()
  // @IsNumber()
  // id: number;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  md5?: string;

  @IsOptional()
  @IsNumber()
  userId?: number;
}
