/**
 * 跨域公开脚本：URL 路径与 cdn_list 下文件名对应（不含 .js）。
 * 落地页 GET .../landing 供用户安装 bookmarklet。
 * website: https://www.roginx.ink
 */

import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@/common/decorators/public.decorator';
import { ReturnType } from '@/common/decorators/return-type.decorator';
import { renderBookmarkLandingHtml } from './bookmark-landing';
import { CdnScriptService } from './cdn-script.service';

@Controller(['cdn-script', 'api/cdn-script'])
export class CdnScriptController {
  constructor(
    private readonly cdnScriptService: CdnScriptService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 书签安装落地页（须写在动态段 :baseName 之前，避免被当成脚本名）
   * 环境变量 BOOKMARKLET_SCRIPT_URL 可覆盖默认脚本地址。
   * 查询参数 ?url= 可临时指定（限 http/https 完整 URL）
   */
  @Get('landing')
  @Public()
  @ReturnType('primitive')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=120')
  getLandingPage(@Query('url') urlOverride?: string): string {
    const defaultUrl =
      'https://edu.roginx.ink/api/cdn-script/yxy2_20260430';
    const fromEnv = this.configService.get<string>('BOOKMARKLET_SCRIPT_URL');
    const scriptUrl = this.pickScriptUrl(urlOverride, fromEnv, defaultUrl);
    return renderBookmarkLandingHtml(scriptUrl);
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
   * 例：仓库文件 src/cdn_list/yxy2_20260430.js → GET .../yxy2_20260430
   */
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
