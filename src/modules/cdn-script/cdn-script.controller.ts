/**
 * 跨域公开脚本、落地页、设备 + 许可证校验（可扩展多脚本 baseName）
 * website: https://www.roginx.ink
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@/common/decorators/public.decorator';
import { ReturnType } from '@/common/decorators/return-type.decorator';
import { renderBookmarkLandingHtml } from './bookmark-landing';
import { CdnScriptService } from './cdn-script.service';
import { CdnScriptLicenseService } from './cdn-script-license.service';
import { LicenseAdminIssueBodyDto, LicenseVerifyBodyDto } from './dto/license.dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller(['cdn-script', 'api/cdn-script'])
export class CdnScriptController {
  constructor(
    private readonly cdnScriptService: CdnScriptService,
    private readonly cdnScriptLicenseService: CdnScriptLicenseService,
    private readonly configService: ConfigService,
  ) {}

  @Get('landing')
  @Public()
  @ReturnType('primitive')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=120')
  getLandingPage(
    @Query('url') urlOverride?: string,
    @Query('base') baseOverride?: string,
  ): string {
    const defaultUrl =
      'https://edu.roginx.ink/api/cdn-script/yxy2_20260430';
    const fromEnv = this.configService.get<string>('BOOKMARKLET_SCRIPT_URL');
    const scriptUrl = this.pickScriptUrl(urlOverride, fromEnv, defaultUrl);
    const publicOrigin = this.configService.get<string>(
      'CDN_PUBLIC_ORIGIN',
      'https://edu.roginx.ink',
    );
    return renderBookmarkLandingHtml({
      scriptUrl,
      scriptBaseName: baseOverride || this.extractBaseNameFromUrl(scriptUrl),
      publicApiOrigin: publicOrigin,
    });
  }

  private extractBaseNameFromUrl(scriptUrl: string): string {
    try {
      const u = new URL(scriptUrl);
      const last = u.pathname.split('/').filter(Boolean).pop() || '';
      return last.replace(/\.js$/i, '') || 'yxy2_20260430';
    } catch {
      return 'yxy2_20260430';
    }
  }

  private pickScriptUrl(
    urlOverride: string | undefined,
    fromEnv: string | undefined,
    fallback: string,
  ): string {
    if (urlOverride && this.isSafePublicUrl(urlOverride)) {
      return urlOverride;
    }
    if (fromEnv && this.isSafePublicUrl(fromEnv)) {
      return fromEnv;
    }
    return fallback;
  }

  private isSafePublicUrl(u: string): boolean {
    if (!u || u.length > 2048) return false;
    try {
      const parsed = new URL(u);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * 设备端校验：考试页 script 与 learning 页均调用
   */
  @Post('license/verify')
  @Public()
  @ReturnType('primitive')
  postVerifyLicense(@Body() body: LicenseVerifyBodyDto) {
    this.cdnScriptLicenseService.assertLicenseValid(
      body.fingerprint,
      body.baseName,
      body.licenseKey,
    );
    return { valid: true, baseName: body.baseName };
  }

  /**
   * 管理后台：凭用户提供的指纹 + 脚本主名，生成可下发的许可证密钥
   */
  @Post('license/admin/issue')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.ISSUE_CDN_SCRIPT_LICENSE)
  @ReturnType('primitive')
  postAdminIssueLicense(@Body() body: LicenseAdminIssueBodyDto) {
    if (!body.fingerprint || !body.baseName) {
      throw new BadRequestException('缺少 fingerprint 或 baseName');
    }
    const licenseKey = this.cdnScriptLicenseService.deriveLicenseKey(
      body.fingerprint.trim(),
      body.baseName.trim(),
    );
    return { licenseKey, baseName: body.baseName.trim() };
  }

  @Get(':baseName')
  @Public()
  @ReturnType('primitive')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Access-Control-Allow-Origin', '*')
  getByFileBaseName(@Param('baseName') baseName: string): string {
    return this.cdnScriptService.getScriptByBaseName(baseName);
  }
}
