/**
 * website: https://www.roginx.ink
 */

import { PartialType } from '@nestjs/mapped-types';
import { Exclude } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { MethodType, PermissionType } from '@/types';

export class CreatePermissionDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(['MENU', 'BUTTON', 'API'] as const)
  @IsOptional()
  type?: PermissionType;

  @IsNumber()
  @IsOptional()
  parentId?: number;

  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  redirect?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  component?: string;

  @IsString()
  @IsOptional()
  layout?: string;

  @IsBoolean()
  @IsOptional()
  keepAlive?: boolean;

  @IsEnum(['GET', 'POST', 'PATCH', 'DELETE'] as const)
  @IsOptional()
  method?: MethodType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  show?: boolean;

  @IsBoolean()
  @IsOptional()
  enable?: boolean;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {
  @IsEnum(['MENU', 'BUTTON', 'API'] as const)
  @IsOptional()
  type?: PermissionType;
}

export class GetPermissionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['MENU', 'BUTTON', 'API'] as const)
  @IsOptional()
  type?: PermissionType;

  @IsOptional()
  enable?: boolean | string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  num?: number | string;
}
