import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStorageAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(['cos', 'oss', 'qiniu'])
  provider?: 'cos' | 'oss' | 'qiniu';

  @IsString()
  @IsNotEmpty()
  accessKey: string;

  @IsString()
  @IsNotEmpty()
  secretKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateStorageAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** 密钥留空 = 不修改；填写 = 轮换 */
  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
