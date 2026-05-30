import type { Request } from 'express';

/**
 * 提取客户端真实 IP（参考 devops-server tracking-base.controller 的实现）
 * 优先级：X-Forwarded-For > X-Real-IP > CF-Connecting-IP > X-Client-IP > req.ip > socket.remoteAddress
 *
 * 部署时务必让 Nginx 设置：
 *   proxy_set_header X-Real-IP $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * Node 端建议同时启用 `app.set('trust proxy', true)` 让 req.ip 生效。
 */
export class ClientIpExtractor {
  static extract(req: Request | undefined | null): string | undefined {
    if (!req) return undefined;
    const headers = (req.headers || {}) as Record<string, string | string[] | undefined>;

    // 1. X-Forwarded-For（取链路最前一个，且非本地 IP）
    const xff = ClientIpExtractor.headerValue(headers, 'x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0].trim();
      if (!ClientIpExtractor.isLocal(first)) return ClientIpExtractor.normalize(first);
    }

    // 2. X-Real-IP（Nginx 推荐）
    const xRealIp = ClientIpExtractor.headerValue(headers, 'x-real-ip');
    if (xRealIp && !ClientIpExtractor.isLocal(xRealIp)) {
      return ClientIpExtractor.normalize(xRealIp);
    }

    // 3. Cloudflare
    const cf = ClientIpExtractor.headerValue(headers, 'cf-connecting-ip');
    if (cf) return ClientIpExtractor.normalize(cf);

    // 4. X-Client-IP
    const xClient = ClientIpExtractor.headerValue(headers, 'x-client-ip');
    if (xClient && !ClientIpExtractor.isLocal(xClient)) {
      return ClientIpExtractor.normalize(xClient);
    }

    // 5. Express 的 req.ip（启用 trust proxy 后会自动解析 X-Forwarded-For）
    if (req.ip && !ClientIpExtractor.isLocal(req.ip)) {
      return ClientIpExtractor.normalize(req.ip);
    }

    // 6. 兜底：socket
    const remote = req.socket?.remoteAddress;
    if (remote) return ClientIpExtractor.normalize(remote);

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

  /** 去除 IPv4-mapped IPv6 前缀（::ffff:1.2.3.4 → 1.2.3.4） */
  private static normalize(ip: string): string {
    return ip.replace(/^::ffff:/, '');
  }

  private static isLocal(ip: string): boolean {
    if (!ip) return true;
    const v = ip.replace(/^::ffff:/, '');
    return v === '::1' || v === '127.0.0.1';
  }
}
