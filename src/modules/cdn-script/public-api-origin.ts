import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Landing / verify URLs must match the host the user opened.
 * Optional CDN_PUBLIC_ORIGIN override; otherwise Host + X-Forwarded-* (reverse proxy).
 */
export function resolvePublicApiOrigin(req: Request, config: ConfigService): string {
  const env = config.get<string>('CDN_PUBLIC_ORIGIN')?.trim();
  if (env) return env.replace(/\/+$/, '');
  const host =
    req.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.get('host') ||
    'localhost';
  const proto =
    req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol || 'http';
  return `${proto}://${host}`;
}
