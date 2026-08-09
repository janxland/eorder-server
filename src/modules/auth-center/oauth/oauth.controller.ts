import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { AuthCenterService } from '../auth-center.service';

/**
 * OAuth2.0 授权码端点
 * 部署公网路径: /api/auth-center/oauth/*（经 Nginx /api/ 反代剥离前缀）
 * 低耦合设计：不动现有 login/refresh-token/logout，只新增本控制器
 */
@Controller('auth-center/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly authCenterService: AuthCenterService,
  ) {}

  /**
   * GET /auth-center/oauth/authorize
   * 1) 校验 client + redirect_uri
   * 2) 若浏览器已有有效 SSO Cookie（sso_access_token）→ 直接 302 回跳 code
   * 3) 否则 → 302 到登录页，登录后回跳（前端登录页带 redirect 参数）
   */
  @Get('authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('response_type') responseType: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 1. 基础校验
    if (responseType !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type' });
    }
    let client;
    try {
      client = await this.oauthService.validateClient(clientId);
    } catch (e) {
      return res.status(401).json({ error: 'invalid_client', message: e.message });
    }
    if (!this.oauthService.validateRedirectUri(client, redirectUri)) {
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }
    const finalScope = this.oauthService.validateScope(client, scope || '');

    // 2. 尝试从 SSO Cookie 取登录态
    const cookieToken = req.cookies?.sso_access_token;
    let userPayload: any = null;
    if (cookieToken) {
      const payload = await this.authCenterService.validateAccessToken(cookieToken);
      if (payload) userPayload = payload;
    }

    // 3a. 已登录 → 直接签发 code 并 302 回跳
    if (userPayload) {
      const code = await this.oauthService.generateCode(
        client,
        redirectUri,
        finalScope,
        userPayload.userId,
        userPayload.username,
        userPayload.roleCodes || [],
        codeChallenge,
      );
      const sep = redirectUri.includes('?') ? '&' : '?';
      const location = `${redirectUri}${sep}code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      this.logger.log(`OAuth authorize 成功(已登录): user=${userPayload.username}, client=${clientId}`);
      return res.redirect(location);
    }

    // 3b. 未登录 → 302 到登录页（保留回跳参数，登录成功后回到本 authorize）
    // 关键：redirect 必须是"绝对 URL"。前端 useSSO.handleSuccessRedirect 用 new URL() 判断：
    //   绝对 URL → window.location.href 整页跳转（正确）；相对路径 → router.replace（vue 内部路由，会 404）。
    // 因此这里用请求的协议+host 构造 https://edu.roginx.ink/api/auth-center/oauth/authorize?...
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('host') || 'edu.roginx.ink';
    const authorizeUrl =
      `${proto}://${host}/api/auth-center/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(finalScope)}` +
      `${state ? `&state=${encodeURIComponent(state)}` : ''}` +
      `${codeChallenge ? `&code_challenge=${encodeURIComponent(codeChallenge)}` : ''}`;
    const loginPageUrl = `/login?redirect=${encodeURIComponent(authorizeUrl)}`;
    this.logger.debug(`OAuth authorize 未登录，跳转登录页: ${loginPageUrl}`);
    return res.redirect(loginPageUrl);
  }

  /**
   * POST /auth-center/oauth/token
   * body: { grant_type: 'authorization_code', code, redirect_uri, client_id, client_secret?, code_verifier? }
   * 或   { grant_type: 'refresh_token', refresh_token, client_id }
   */
  @Post('token')
  async token(@Body() body: any, @Res() res: Response) {
    const { grant_type } = body;
    if (!grant_type) {
      return res.status(400).json({ error: 'invalid_request', message: '缺少 grant_type' });
    }

    // 校验 client（confidential 需校验 secret；public 仅需存在）
    let client;
    try {
      client = await this.oauthService.validateClient(body.client_id);
      if (client.type === 'confidential') {
        if (!body.client_secret || body.client_secret !== client.clientSecret) {
          return res.status(401).json({ error: 'invalid_client', message: 'client_secret 错误' });
        }
      }
    } catch (e) {
      return res.status(401).json({ error: 'invalid_client', message: e.message });
    }

    try {
      if (grant_type === 'authorization_code') {
        const result = await this.oauthService.exchangeCode(
          client,
          body.code,
          body.redirect_uri,
          body.code_verifier,
        );
        return res.json(result);
      }

      if (grant_type === 'refresh_token') {
        const result = await this.oauthService.refreshAccessToken(body.refresh_token, body.client_id);
        return res.json(result);
      }

      return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (e) {
      const status = e.status || e.statusCode || 400;
      return res.status(status).json({ error: 'invalid_grant', message: e.message });
    }
  }

  /**
   * GET /auth-center/oauth/clients （管理用，列出已注册 client，脱敏）
   */
  @Get('clients')
  async listClients(@Res() res: Response) {
    const clients = await this.oauthService.listClients();
    return res.json({ success: true, data: clients });
  }
}
