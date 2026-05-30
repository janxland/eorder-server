import type { Request } from 'express';

/**
 * 提取登录来源的"域名 + 端口"（host）。
 *
 * 策略：
 *   1. Origin 头（浏览器对跨域请求自动带，最规范）
 *   2. Referer 头（部分场景 Origin 缺失时回退）
 *   3. Host 头（同源请求兜底）
 *
 * 返回值不含协议（http/https）和路径，例如：
 *   - "admin.roginx.ink"
 *   - "localhost:9000"
 */
export class OriginExtractor {
  static extract(req: Request | undefined | null): string | undefined {
    if (!req) return undefined;
    const headers = (req.headers || {}) as Record<string, string | string[] | undefined>;

    const origin = OriginExtractor.headerValue(headers, 'origin');
    if (origin) {
      const host = OriginExtractor.parseHost(origin);
      if (host) return host;
    }

    const referer = OriginExtractor.headerValue(headers, 'referer');
    if (referer) {
      const host = OriginExtractor.parseHost(referer);
      if (host) return host;
    }

    const host = OriginExtractor.headerValue(headers, 'host');
    if (host) return host;

    return undefined;
  }

  private static headerValue(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ): string | null {
    const v = headers[key];
    if (!v) return null;
    return Array.isArray(v) ? v[0] : v;
  }

  /** 从 URL（http://host:port/path）中取 host:port */
  private static parseHost(url: string): string | null {
    try {
      return new URL(url).host || null;
    } catch {
      return null;
    }
  }
}
