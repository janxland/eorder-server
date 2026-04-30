/**
 * CDN 脚本许可证：HMAC(主密钥, 设备指纹:脚本主文件名) 与用户提交比对。
 * 主密钥环境变量 CDN_MASTER_SECRET，缺省为 JANXLAND（仅作默认，生产务必改 .env）
 * website: https://www.roginx.ink
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class CdnScriptLicenseService {
  constructor(private readonly configService: ConfigService) {}

  private getMasterSecret(): string {
    return (
      this.configService.get<string>('CDN_MASTER_SECRET') || 'JANXLAND'
    );
  }

  /**
   * 与 cdn_list 中文件主名一致，如 yxy2_20260430
   */
  deriveLicenseKey(fingerprint: string, baseName: string): string {
    const secret = this.getMasterSecret();
    return createHmac('sha256', secret)
      .update(`${fingerprint}:${baseName}`)
      .digest('hex');
  }

  assertLicenseValid(
    fingerprint: string,
    baseName: string,
    submittedKey: string,
  ): void {
    if (!fingerprint || !baseName || !submittedKey) {
      throw new UnauthorizedException('缺少指纹、脚本名或密钥');
    }
    const expected = this.deriveLicenseKey(
      fingerprint.trim(),
      baseName.trim(),
    );
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(submittedKey.replace(/\s+/g, '').toLowerCase(), 'utf8');
    if (a.length !== b.length) {
      throw new UnauthorizedException('授权密钥无效');
    }
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('授权密钥无效');
    }
  }
}
