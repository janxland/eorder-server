import { IsString, IsOptional, IsNumber, Allow } from 'class-validator';
import { KeyValue } from './key-value.entity';

export class GetKeyValueDto {
  @Allow()
  id?: number;

  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;

  @Allow()
  key?: string;

  @Allow()
  type?: string;

  @Allow()
  desc?: string;

  @Allow()
  createdAt?: string;

  @Allow()
  updatedAt?: string;

//   @Allow()
//   enable?: boolean;

}

export class CreateKeyValueDto extends KeyValue{
  @IsString()
  key: string;

  @IsOptional()
  value: any;
}

export class UpdateKeyValueDto {
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  value?: any;
}