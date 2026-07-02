/**
 * CDN 脚本控制器：提供落地页和脚本下载
 * website: https://www.roginx.ink
 */

import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '@/common/decorators/public.decorator';
import { ReturnType } from '@/common/decorators/return-type.decorator';
import { CDN_LANDING_ROUTE_KEYS } from './cdn-landing-route-keys';
import { renderBookmarkLandingHtml } from './bookmark-landing';
import { resolvePublicApiOrigin } from './public-api-origin';
import { CdnScriptService } from './cdn-script.service';

@Controller(['cdn-script', 'api/cdn-script'])
export class CdnScriptController {
  constructor(
    private readonly cdnScriptService: CdnScriptService,
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

  @Get(':baseName')
  @Public()
  @ReturnType('primitive')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Access-Control-Allow-Origin', '*')
  getByFileBaseName(@Param('baseName') baseName: string): string {
    return this.cdnScriptService.getScriptByBaseName(baseName);
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
}
