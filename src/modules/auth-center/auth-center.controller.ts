import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthCenterService } from './auth-center.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { Request, Response } from 'express';

@Controller('auth-center')
export class AuthCenterController {
  private readonly logger = new Logger(AuthCenterController.name);

  constructor(private readonly authCenterService: AuthCenterService) {}

  /**
   * 用户登录 - SSO增强版
   * 添加Cookie支持，实现跨子域单点登录（*.roginx.ink）
   */
  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // 验证用户凭据
    const user = await this.authCenterService.validateUser(
      loginDto.username,
      loginDto.password
    );
    
    if (!user) {
      return {
        success: false,
        message: '用户名或密码错误'
      };
    }
    
    // 生成登录凭证
    const result = await this.authCenterService.login(user, req);
    
    // 🔥 SSO：设置Cookie实现跨子域单点登录
    const cookieDomain = this.getCookieDomain(req);
    
    // 验证token是否存在
    if (!result || !result.accessToken || !result.refreshToken) {
      this.logger.error(`SSO Login Error: Token生成失败`, { result });
      throw new Error('Token生成失败');
    }
    
    this.logger.log(`🔍 准备设置Cookie - Domain: ${cookieDomain}, Host: ${req.get('host')}, Origin: ${req.get('origin')}`);
    this.logger.log(`🔍 Token信息 - AccessToken长度: ${result.accessToken?.length}, RefreshToken长度: ${result.refreshToken?.length}`);
    
    // 判断是否是HTTPS
    const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    const shouldUseSecure = process.env.NODE_ENV === 'production' || isSecure;
    
    // 设置 Cookie 选项
    const cookieOptions = {
      domain: cookieDomain,
      httpOnly: true,  // 防止XSS攻击
      secure: shouldUseSecure,  // 生产环境或HTTPS启用Secure
      sameSite: 'lax' as const,  // CSRF防护
      path: '/',
    };
    
    this.logger.log(`🔍 Cookie选项: ${JSON.stringify(cookieOptions)}`);
    
    // 设置 Access Token Cookie
    try {
      res.cookie('sso_access_token', result.accessToken, {
        ...cookieOptions,
        maxAge: result.expiresIn * 1000,  // 过期时间（秒转毫秒）
      });
      this.logger.log(`✅ Set Cookie: sso_access_token, Domain: ${cookieDomain}, MaxAge: ${result.expiresIn * 1000}ms`);
    } catch (error) {
      this.logger.error(`❌ 设置Access Token Cookie失败:`, error);
    }

    // 设置 Refresh Token Cookie
    try {
      res.cookie('sso_refresh_token', result.refreshToken, {
        ...cookieOptions,
        maxAge: 90 * 24 * 60 * 60 * 1000,  // 90天
      });
      this.logger.log(`✅ Set Cookie: sso_refresh_token, Domain: ${cookieDomain}, MaxAge: 90d`);
    } catch (error) {
      this.logger.error(`❌ 设置Refresh Token Cookie失败:`, error);
    }

    // 验证Cookie是否设置成功（通过检查响应头）
    const setCookieHeaders = res.getHeader('Set-Cookie');
    this.logger.log(`🔍 Set-Cookie响应头:`, setCookieHeaders);

    this.logger.log(`🎉 SSO Login Success: ${loginDto.username}, Cookie Domain: ${cookieDomain}, Host: ${req.get('host')}`);
    
    return {
      success: true,
      ...result,
      ssoEnabled: true,
      cookieDomain,
    };
  }

  /**
   * 获取Cookie的domain配置
   * 根据请求host自动判断
   */
  private getCookieDomain(req: Request): string {
    const host = req.get('host') || '';
    const origin = req.get('origin') || '';
    
    this.logger.debug(`🔍 Cookie Domain Detection - Host: ${host}, Origin: ${origin}, NODE_ENV: ${process.env.NODE_ENV}`);
    
    // 开发环境
    if (process.env.NODE_ENV === 'development' || host.includes('localhost')) {
      this.logger.debug(`✅ Using domain: localhost`);
      return 'localhost';
    }
    
    // 生产环境 - 提取顶级域名（支持 *.roginx.ink）
    if (host.includes('roginx.ink')) {
      const domain = '.roginx.ink';  // 注意：顶级域前面需要加 "."
      this.logger.debug(`✅ Using domain: ${domain} (for roginx.ink)`);
      return domain;
    }
    
    // 其他环境：提取最后两个部分作为顶级域名
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const domain = `.${parts.slice(-2).join('.')}`;
        this.logger.debug(`✅ Using domain: ${domain} (extracted from ${host})`);
        return domain;
      }
    }
    
    // 默认返回当前host（不推荐，但作为后备）
    this.logger.warn(`⚠️ Using default domain: ${host} (no match found)`);
    return host;
  }

  /**
   * 刷新访问令牌 - SSO增强版
   * 同时更新Cookie中的token
   */
  @Post('refresh-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authCenterService.refreshToken(refreshTokenDto.refreshToken, req);
    
    // 更新Cookie中的Access Token
    const cookieDomain = this.getCookieDomain(req);
    res.cookie('sso_access_token', result.accessToken, {
      domain: cookieDomain,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: result.expiresIn * 1000,
      path: '/',
    });
    
    return {
      success: true,
      ...result
    };
  }

  /**
   * 登出系统 - SSO增强版
   * 清除Cookie和服务器端Token
   */
  @Post('logout')
  @UseGuards(AuthCenterGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.userId;
    const result = await this.authCenterService.logout(userId, req);
    
    // 清除Cookie
    const cookieDomain = this.getCookieDomain(req);
    res.clearCookie('sso_access_token', { domain: cookieDomain, path: '/' });
    res.clearCookie('sso_refresh_token', { domain: cookieDomain, path: '/' });
    
    return {
      success: true,
      message: '登出成功'
    };
  }

  /**
   * 获取当前用户信息
   */
  @Get('profile')
  @UseGuards(AuthCenterGuard)
  async getProfile(@Req() req: any) {
    const userId = req.user?.userId;
    const profile = await this.authCenterService.getUserProfile(userId);
    return {
      success: true,
      ...profile
    };
  }

  /**
   * 验证token有效性 - SSO增强版
   * 支持从Authorization头、Cookie或请求体读取token
   */
  @Post('verify-token')
  async verifyToken(@Body() body: { token?: string }, @Req() req: Request) {
    this.logger.log(`🔍 Verify Token Request - Host: ${req.get('host')}, Origin: ${req.get('origin')}`);
    
    // 优先级：Authorization头 > 请求体 > Cookie
    let token: string | undefined;
    
    // 1. 从Authorization头读取
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      this.logger.debug('Reading token from Authorization header');
    }
    
    // 2. 从请求体读取
    if (!token && body.token) {
      token = body.token;
      this.logger.debug('Reading token from request body');
    }
    
    // 3. 从Cookie读取
    if (!token) {
      token = req.cookies?.sso_access_token;
      this.logger.debug(`Reading token from Cookie - Cookies: ${JSON.stringify(Object.keys(req.cookies || {}))}`);
    }
    
    if (!token) {
      this.logger.warn('❌ No token provided in Authorization header, body, or Cookie');
      return {
        success: false,
        valid: false,
        message: '未提供token',
        tokenSource: null,
      };
    }
    
    this.logger.log(`✅ Token found - Source: ${token === authHeader?.substring(7) ? 'Authorization' : token === body.token ? 'Body' : 'Cookie'}`);
    
    try {
      const result = await this.authCenterService.verifyToken(token);
      this.logger.log(`🔍 Token verification result - Valid: ${result.valid}, UserId: ${result.userId || 'N/A'}`);
      
      return {
        success: true,
        ...result,
        tokenSource: token === authHeader?.substring(7) ? 'Authorization' : token === body.token ? 'Body' : 'Cookie',
      };
    } catch (error) {
      this.logger.error(`❌ Token verification failed:`, error);
      return {
        success: false,
        valid: false,
        message: 'Token验证失败',
        error: error.message,
      };
    }
  }

  @UseGuards(AuthCenterGuard)
  @Get('sessions')
  async getUserSessions(@Req() req: any) {
    return this.authCenterService.getUserActiveSessions(req.user.userId);
  }

  @UseGuards(AuthCenterGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @Req() req: any) {
    // 这里需要添加额外的安全检查，确保用户只能撤销自己的会话
    const session = await this.authCenterService.revokeRefreshToken(id);
    return { success: !!session };
  }

  /**
   * 获取SSO配置信息（用于前端调试）
   */
  @Get('sso-config')
  getSSOConfig(@Req() req: Request) {
    const host = req.get('host') || '';
    const cookieDomain = this.getCookieDomain(req);
    
    return {
      success: true,
      currentHost: host,
      cookieDomain,
      environment: process.env.NODE_ENV,
      cookieEnabled: true,
      cookieSecure: process.env.NODE_ENV === 'production',
      cookies: req.cookies || {},
    };
  }

  /**
   * 检查是否存在超级管理员
   */
  @Get('check-admin')
  async checkAdmin() {
    this.logger.debug('检查是否存在超级管理员');
    const hasAdmin = await this.authCenterService.checkHasAdmin();
    this.logger.debug(`超级管理员检查结果: ${hasAdmin}`);
    
    return {
      success: true,
      hasAdmin
    };
  }

  /**
   * 初始化超级管理员
   */
  @Post('init-admin')
  async initAdmin(@Body() data: any) {
    this.logger.debug(`初始化超级管理员: 用户名=${data.username}`);
    
    const result = await this.authCenterService.initAdmin(data.username, data.password);
    this.logger.debug(`初始化结果: ${JSON.stringify(result)}`);
    
    return {
      success: true,
      ...result
    };
  }
}