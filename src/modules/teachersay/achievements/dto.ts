import { Exclude } from 'class-transformer';
import {
  Allow
} from 'class-validator';


import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsNumber, 
  IsDateString, 
  IsArray, 
  ArrayNotEmpty, 
  ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';
import { AchievementStatus } from './achievement.entity';

export class CreateAchievementDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @IsOptional()
  typeId?: number; // AchievementType 的 ID

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  authorIds?: number[]; // 作者（Teacher）的 ID 列表

  @IsDateString()
  @IsOptional()
  publishedDate?: string; // ISO 格式日期字符串

  @IsEnum(AchievementStatus)
  @IsOptional()
  status?: AchievementStatus;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  keywords?: string;

  @IsNumber()
  @IsOptional()
  citationCount?: number;

  @IsString()
  @IsOptional()
  link?: string;

  @IsNumber()
  @IsOptional()
  fundingAmount?: number;

  @IsDateString()
  @IsOptional()
  completionDate?: string; // ISO 格式日期字符串

  @IsString()
  @IsOptional()
  attachments?: string;

  @IsNumber()
  @IsOptional()
  responsibleUserId?: number; // 负责人（Teacher）的 ID

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  teamMemberIds?: number[]; // 团队成员（Teacher）的 ID 列表
}

export class updateAchievementDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsOptional()
  citationCount?: number;
  status?: string;

  @IsNumber()
  @IsOptional()
  typeId?: number; // AchievementType 的 ID

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  authorIds?: number[]; // 作者（Teacher）的 ID 列表
}

export class GetAchievementDto {
  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;

  @Allow()
  title?: string;

  @Allow()
  responsibleUserId?: number;

  @Allow()
  typeId?: number;

  @Allow()
  authorId?: number;
  
  @Allow()
  authorIds?: number[];

  @Allow()
  status?: string;
}
