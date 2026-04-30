/**
 * 须在字段上加 class-validator：全局 ValidationPipe 开启了 whitelist，
 * 未装饰的属性会被剔除，导致 body 为空。
 * website: https://www.roginx.ink
 */

import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LicenseVerifyBodyDto {
  @IsString()
  @IsNotEmpty()
  fingerprint: string;

  @IsString()
  @IsNotEmpty()
  licenseKey: string;

  /** 与 cdn_list 文件名主名一致，如 yxy2_20260430 */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
  baseName: string;
}

export class LicenseAdminIssueBodyDto {
  @IsString()
  @IsNotEmpty()
  fingerprint: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
  baseName: string;
}
