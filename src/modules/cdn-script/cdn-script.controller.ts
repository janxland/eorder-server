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
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '@/common/decorators/public.decorator';
import { ReturnType } from '@/common/decorators/return-type.decorator';
import { CDN_LANDING_ROUTE_KEYS } from './cdn-landing-route-keys';
import { renderBookmarkLandingHtml } from './bookmark-landing';
import { resolvePublicApiOrigin } from './public-api-origin';
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
    @Req() req: Request,
    @Query('url') urlOverride?: string,
    @Query('base') baseOverride?: string,
  ): string {
    const origin = resolvePublicApiOrigin(req, this.configService);
    const defaultUrl = `${origin}/api/cdn-script/yxy2_20260430`;
    const fromEnv = this.configService.get<string>('BOOKMARKLET_SCRIPT_URL');
    const scriptUrl = this.pickScriptUrl(urlOverride, fromEnv, defaultUrl);
    return renderBookmarkLandingHtml({
      scriptUrl,
      scriptBaseName: baseOverride || this.extractBaseNameFromUrl(scriptUrl),
      publicApiOrigin: origin,
    });
  }

  /**
   * 短链落地页：枚举键 → cdn_list 脚本（便于收藏夹 URL 缩短）
   * 例：GET /api/cdn-script/landing/pa
   */
  @Get('landing/:shortKey')
  @Public()
  @ReturnType('primitive')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=120')
  getLandingPageByShortKey(
    @Req() req: Request,
    @Param('shortKey') shortKey: string,
  ): string {
    const key = (shortKey || '').trim().toLowerCase();
    const entry = CDN_LANDING_ROUTE_KEYS[key];
    if (!entry) {
      throw new NotFoundException(`未知的落地页短链: ${shortKey}`);
    }
    const origin = resolvePublicApiOrigin(req, this.configService);
    const scriptUrl = `${origin}/api/cdn-script/${encodeURIComponent(entry.scriptBaseName)}`;
    return renderBookmarkLandingHtml({
      scriptUrl,
      scriptBaseName: entry.scriptBaseName,
      publicApiOrigin: origin,
      bookmarkLabel: entry.bookmarkLabel,
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
