import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OauthClient, OAuthClientType } from './oauth-client.entity';
import { AuthCenterService } from '../auth-center.service';
import { RedisService } from '@/shared/redis.service';

/**
 * OAuth2.0 授权码模式（Authorization Code + PKCE 可选）
 * 复用 AuthCenter 现有账号体系与 token 机制，低耦合：
 * - code: 一次性、5min 有效、存 Redis
 * - accessToken/refreshToken: 复用 AuthCenterService.generateTokens()（6h + 90天）
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  /** 授权码有效期（秒） */
  private readonly CODE_EXPIRATION = 300; // 5min
  /** code 前缀，Redis 键: oauth:code:{code} */
  private readonly CODE_KEY_PREFIX = 'oauth:code:';
  /** 已使用 code 防重放前缀: oauth:used:{code} */
  private readonly USED_KEY_PREFIX = 'oauth:used:';

  constructor(
    @InjectRepository(OauthClient)
    private readonly oauthClientRepository: Repository<OauthClient>,
    @Inject(forwardRef(() => AuthCenterService))
    private readonly authCenterService: AuthCenterService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 校验 client 是否注册且可用
   */
  async validateClient(clientId: string): Promise<OauthClient> {
    const client = await this.oauthClientRepository.findOne({
      where: { clientId },
    });
    if (!client || !client.isActive) {
      throw new UnauthorizedException('未知或已停用的 OAuth client');
    }
    return client;
  }

  /**
   * 校验回调地址是否在白名单内（支持 * 通配符，如 http://127.0.0.1:*）
   */
  validateRedirectUri(client: OauthClient, redirectUri: string): boolean {
    if (!redirectUri) return false;
    return client.allowedRedirectUris.some((pattern) => {
      if (pattern === redirectUri) return true;
      // 简单通配：pattern 中 * 匹配任意字符
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
        );
        return regex.test(redirectUri);
      }
      return false;
    });
  }

  /**
   * 校验 scope 是否被 client 允许
   */
  validateScope(client: OauthClient, scope?: string): string {
    const requested = scope ? scope.split(/\s+/) : [];
    const allowed = client.allowedScopes || [];
    const invalid = requested.filter((s) => !allowed.includes(s));
    if (invalid.length > 0) {
      throw new BadRequestException(`未授权的 scope: ${invalid.join(', ')}`);
    }
    return requested.join(' ');
  }

  /**
   * 生成授权码（authorize 端点）
   * @param clientId client 标识
   * @param redirectUri 回调地址
   * @param scope 申请的权限范围
   * @param userId 已登录用户（来自 SSO Cookie / 登录后回跳）
   * @param username 用户名
   * @param roleCodes 用户角色
   * @param codeChallenge PKCE challenge（可选）
   */
  async generateCode(
    client: OauthClient,
    redirectUri: string,
    scope: string,
    userId: number,
    username: string,
    roleCodes: string[],
    codeChallenge?: string,
  ): Promise<string> {
    const code = uuidv4().replace(/-/g, '');
    const payload = JSON.stringify({
      clientId: client.clientId,
      redirectUri,
      scope,
      userId,
      username,
      roleCodes,
      codeChallenge: codeChallenge || null,
      iat: Date.now(),
    });
    await this.redisService.set(
      `${this.CODE_KEY_PREFIX}${code}`,
      payload,
      this.CODE_EXPIRATION,
    );
    this.logger.debug(`授权码已生成: client=${client.clientId}, user=${username}, ttl=${this.CODE_EXPIRATION}s`);
    return code;
  }

  /**
   * 用 code 换取 token（token 端点）
   * @param client 校验通过的 client
   * @param code 授权码
   * @param redirectUri 回调地址（必须与 authorize 时一致）
   * @param codeVerifier PKCE verifier（若 authorize 时提供过 challenge 则必填）
   */
  async exchangeCode(
    client: OauthClient,
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<any> {
    if (!code) {
      throw new BadRequestException('缺少授权码 code');
    }

    // 防重放：已使用过的 code 直接拒绝
    const used = await this.redisService.get(`${this.USED_KEY_PREFIX}${code}`);
    if (used) {
      throw new UnauthorizedException('授权码已使用');
    }

    // 读取并校验 code
    const stored = await this.redisService.get(`${this.CODE_KEY_PREFIX}${code}`);
    if (!stored) {
      throw new UnauthorizedException('授权码无效或已过期');
    }

    let payload: any;
    try {
      payload = JSON.parse(stored);
    } catch {
      throw new UnauthorizedException('授权码格式错误');
    }

    // 校验归属：code 必须是该 client 的，且回调地址一致
    if (payload.clientId !== client.clientId) {
      throw new UnauthorizedException('授权码与 client 不匹配');
    }
    if (redirectUri && payload.redirectUri !== redirectUri) {
      throw new UnauthorizedException('回调地址与授权时不一致');
    }

    // PKCE 校验
    if (payload.codeChallenge) {
      if (!codeVerifier) {
        throw new UnauthorizedException('缺少 PKCE code_verifier');
      }
      const crypto = await import('crypto');
      const challenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      if (challenge !== payload.codeChallenge) {
        throw new UnauthorizedException('PKCE 校验失败');
      }
    }

    // 标记 code 已使用（防重放，保留与 code 有效期相同的 ttl）
    await this.redisService.set(
      `${this.USED_KEY_PREFIX}${code}`,
      '1',
      this.CODE_EXPIRATION,
    );
    await this.redisService.del(`${this.CODE_KEY_PREFIX}${code}`);

    // 复用 AuthCenter 生成 token（6h access + 90天 refresh，多端会话管理）
    const tokens = await this.authCenterService.generateTokens({
      userId: payload.userId,
      username: payload.username,
      roleCodes: payload.roleCodes || [],
      currentRoleCode: payload.roleCodes?.[0] || 'guest',
      scope: payload.scope,
      oauthClientId: client.clientId,
    });

    return {
      ...tokens,
      scope: payload.scope,
      oauthClientId: client.clientId,
    };
  }

  /**
   * 刷新 accessToken（refresh 端点）
   * 直接复用 AuthCenterService.refreshToken（90 天有效期，续期自动延长）
   */
  async refreshAccessToken(refreshTokenString: string, clientId: string): Promise<any> {
    if (!refreshTokenString) {
      throw new BadRequestException('缺少 refresh_token');
    }
    const result = await this.authCenterService.refreshToken(refreshTokenString, {
      headers: { 'user-agent': 'roginx-cli' },
    });
    return {
      ...result,
      oauthClientId: clientId,
    };
  }

  /**
   * 注册新 client（管理用途）
   */
  async createClient(dto: {
    clientId: string;
    clientSecret?: string;
    clientName: string;
    type?: OAuthClientType;
    allowedRedirectUris: string[];
    allowedScopes?: string[];
    isActive?: boolean;
  }): Promise<OauthClient> {
    const exists = await this.oauthClientRepository.findOne({
      where: { clientId: dto.clientId },
    });
    if (exists) {
      throw new BadRequestException(`client_id 已存在: ${dto.clientId}`);
    }
    const client = this.oauthClientRepository.create({
      clientId: dto.clientId,
      clientSecret: dto.clientSecret || null,
      clientName: dto.clientName,
      type: dto.type || OAuthClientType.PUBLIC,
      allowedRedirectUris: dto.allowedRedirectUris,
      allowedScopes: dto.allowedScopes || ['storage:write'],
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return this.oauthClientRepository.save(client);
  }

  /**
   * 列出已注册 client（脱敏：隐藏 client_secret）
   */
  async listClients(): Promise<any[]> {
    const clients = await this.oauthClientRepository.find();
    return clients.map((c) => ({
      clientId: c.clientId,
      clientName: c.clientName,
      type: c.type,
      allowedRedirectUris: c.allowedRedirectUris,
      allowedScopes: c.allowedScopes,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));
  }
}
