import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards, Logger, UsePipes, ValidationPipe, Header, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthCenterService } from './auth-center.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
        code: 401,
        success: false,
        message: '用户名或密码错误'
      };
    }
    
    // 生成登录凭证
    const result = await this.authCenterService.login(user, req);
    
    // 设置Cookie实现跨子域单点登录
    const cookieDomain = this.getCookieDomain(req);
    
    if (!result || !result.accessToken || !result.refreshToken) {
      this.logger.error('SSO Login Error: Token生成失败', { result });
      throw new Error('Token生成失败');
    }
    
    // 判断是否是HTTPS
    const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    const shouldUseSecure = process.env.NODE_ENV === 'production' || isSecure;
    
    // 设置 Cookie 选项
    const cookieOptions: any = {
      httpOnly: true,
      secure: shouldUseSecure,
      sameSite: shouldUseSecure ? 'none' : 'lax',
      path: '/',
    };
    
    // 只有在需要时才设置 domain
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }
    
    // 设置 Access Token Cookie
    res.cookie('sso_access_token', result.accessToken, {
      ...cookieOptions,
      maxAge: result.expiresIn * 1000,
    });

    // 设置 Refresh Token Cookie
    res.cookie('sso_refresh_token', result.refreshToken, {
      ...cookieOptions,
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    this.logger.log(`SSO Login Success: ${loginDto.username}, Domain: ${cookieDomain}`);
    
    return {
      code: 200,
      message: '登录成功',
      success: true,
      data: {
        ...result,
        ssoEnabled: true,
        cookieDomain,
      }
    };
  }

  /**
   * 获取Cookie的domain配置
   * 根据请求host自动判断
   */
  private getCookieDomain(req: Request): string | undefined {
    const host = req.get('host') || '';
    const hostname = host.split(':')[0]; // 移除端口号
    
    this.logger.debug(`Original host: ${host}, hostname: ${hostname}`);
    
    // 开发环境 - localhost 或 IP 地址不设置 domain
    if (process.env.NODE_ENV === 'development' || 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      this.logger.debug('Development environment or localhost/IP detected, not setting domain');
      return undefined; // 不设置 domain，让浏览器自动处理
    }
    
    // 生产环境 - 支持 *.roginx.ink 子域
    if (hostname.includes('roginx.ink')) {
      this.logger.debug('roginx.ink domain detected, setting domain to .roginx.ink');
      return '.roginx.ink';
    }
    
    // 其他域名：只有在是子域名时才设置顶级域名
    if (hostname.includes('.')) {
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        // 是子域名，设置顶级域名以支持跨子域
        const topLevelDomain = `.${parts.slice(-2).join('.')}`;
        this.logger.debug(`Subdomain detected, setting domain to: ${topLevelDomain}`);
        return topLevelDomain;
      } else if (parts.length === 2) {
        // 是顶级域名，不设置 domain
        this.logger.debug('Top-level domain detected, not setting domain');
        return undefined;
      }
    }
    
    // 默认不设置 domain
    this.logger.warn(`No domain pattern matched for host: ${host}, not setting domain`);
    return undefined;
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
    const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    const shouldUseSecure = process.env.NODE_ENV === 'production' || isSecure;
    
    const cookieOptions: any = {
      httpOnly: true,
      secure: shouldUseSecure,
      sameSite: shouldUseSecure ? 'none' : 'lax',
      maxAge: result.expiresIn * 1000,
      path: '/',
    };
    
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }
    
    res.cookie('sso_access_token', result.accessToken, cookieOptions);
    
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
    const clearOptions: any = { path: '/' };
    
    if (cookieDomain) {
      clearOptions.domain = cookieDomain;
    }
    
    res.clearCookie('sso_access_token', clearOptions);
    res.clearCookie('sso_refresh_token', clearOptions);
    
    return {
      success: true,
      message: '登出成功'
    };
  }

  /**
   * 跨域 SSO 登出 - 清除所有 *.roginx.ink 子域的 Token
   * 支持从任何子域调用，清除跨域 Cookie
   */
  @Post('sso-logout')
  async ssoLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      // 动态设置 CORS 头部
      const origin = req.headers.origin;
      if (origin && origin.includes('roginx.ink')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Accept');
      }
      
      // 尝试从Cookie获取用户信息进行服务器端清理
      let token = req.cookies?.sso_access_token;
      let userId: number | null = null;
      
      if (token) {
        try {
          const tokenResult = await this.authCenterService.verifyToken(token);
          if (tokenResult.valid) {
            userId = tokenResult.userId;
          }
        } catch (error) {
          this.logger.warn('Token验证失败，但继续执行登出:', error.message);
        }
      }
      
      // 如果有有效的用户ID，清除服务器端token
      if (userId) {
        await this.authCenterService.revokeAllUserTokens(userId);
        this.logger.log(`SSO Logout: 已清除用户 ${userId} 的所有服务器端token`);
      }
      
      // 关键：清除所有可能的Cookie域
      const clearConfigs = [
        // 主域名 .roginx.ink
        { domain: '.roginx.ink', path: '/' },
        // 当前请求域名
        { domain: this.getCookieDomain(req), path: '/' },
        // 不指定域名（当前域名）
        { path: '/' }
      ];
      
      // 清除所有配置下的Cookie
      clearConfigs.forEach(config => {
        const clearOptions: any = { path: config.path };
        if (config.domain) {
          clearOptions.domain = config.domain;
        }
        
        // 清除双token
        res.clearCookie('sso_access_token', clearOptions);
        res.clearCookie('sso_refresh_token', clearOptions);
        
        this.logger.debug(`清除Cookie: domain=${config.domain || 'current'}, path=${config.path}`);
      });
      
      return {
        code: 200,
        success: true,
        data: {
          message: 'SSO登出成功',
          clearedDomains: ['.roginx.ink', '当前域名'],
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      this.logger.error('SSO登出失败:', error);
      return {
        code: 500,
        success: false,
        data: {
          message: 'SSO登出失败',
          error: error.message
        }
      };
    }
  }

  /**
   * 同步登录状态 - 用于跨域 SSO状态同步
   * 从 Cookie中读取 token并返回用户信息（不返回敏感 token）
   */
  @Get('sync-login-status')
  async syncLoginStatus(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      // 🔥 动态设置 CORS 头部
      const origin = req.headers.origin;
      if (origin && origin.includes('roginx.ink')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Accept');
      }
      
      // 从Cookie读取token
      const token = req.cookies?.sso_access_token;
      
      if (!token) {
        return {
          code: 401,
          success: false,
          data: {
            isLoggedIn: false,
            message: '未找到登录凭证'
          }
        };
      }
      
      // 验证token
      const result = await this.authCenterService.verifyToken(token);
      
      if (result.valid) {
        return {
          code: 200,
          success: true,
          data: {
            isLoggedIn: true,
            user: {
              userId: result.userId,
              username: result.username,
              roles: result.roles
            },
            tokenSource: 'Cookie',
            domain: req.get('host')
          }
        };
      } else {
        return {
          code: 401,
          success: false,
          data: {
            isLoggedIn: false,
            message: 'Token无效或已过期'
          }
        };
      }
    } catch (error) {
      this.logger.error('同步登录状态失败:', error);
      return {
        code: 500,
        success: false,
        data: {
          isLoggedIn: false,
          message: '同步失败',
          error: error.message
        }
      };
    }
  }

  /**
   * 获取用户资料
   */
  @Get('profile')
  @UseGuards(AuthCenterGuard)
  async getProfile(@Req() req: any) {
    const userId = req.user?.userId;
    const profile = await this.authCenterService.getUserProfile(userId);
    return {
      code: 200,
      success: true,
      data: profile
    };
  }

  // ============================================================
  //                  多端会话管理 API（新增）
  // ============================================================

  /**
   * 获取我的全部活跃会话（多设备列表）
   */
  @Get('sessions')
  @UseGuards(AuthCenterGuard)
  async listMySessions(@Req() req: any) {
    const userId = req.user?.userId;
    const currentSid = req.user?.sid;
    const [sessions, maxSessions] = await Promise.all([
      this.authCenterService.getUserActiveSessions(userId, currentSid),
      this.authCenterService.getMaxSessions(),
    ]);
    return {
      sessions,
      maxSessions,
      currentSessionId: currentSid,
      total: sessions.length,
    };
  }

  /**
   * 撤销我的某个会话（踢下线某台设备）
   */
  @Delete('sessions/:sessionId')
  @UseGuards(AuthCenterGuard)
  async revokeMySession(@Req() req: any, @Param('sessionId') sessionId: string) {
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      throw new NotFoundException('会话ID无效');
    }
    const userId = req.user?.userId;
    const ok = await this.authCenterService.revokeSession(sessionId, userId);
    if (!ok) throw new NotFoundException('会话不存在或不属于当前用户');
    return { revoked: true, sessionId };
  }

  /**
   * 获取多设备登录配置（最大会话数 / 驱逐策略）
   */
  @Get('sessions-config')
  @UseGuards(AuthCenterGuard)
  async getSessionsConfig() {
    const [maxSessions, evictionPolicy] = await Promise.all([
      this.authCenterService.getMaxSessions(),
      this.authCenterService.getEvictionPolicyName(),
    ]);
    return { maxSessions, evictionPolicy };
  }

  /**
   * 更新多设备登录配置（仅 SUPER_ADMIN）
   */
  @Post('sessions-config')
  @UseGuards(AuthCenterGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateSessionsConfig(
    @Req() req: any,
    @Body() body: { maxSessions?: number; evictionPolicy?: 'fifo' | 'lru' },
  ) {
    const roles: string[] = req.user?.roleCodes ?? [];
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('admin')) {
      throw new ForbiddenException('权限不足');
    }

    const tasks: Array<Promise<any>> = [];
    if (body?.maxSessions != null) {
      tasks.push(this.authCenterService.setMaxSessions(body.maxSessions));
    }
    if (body?.evictionPolicy) {
      tasks.push(this.authCenterService.setEvictionPolicy(body.evictionPolicy));
    }
    await Promise.all(tasks);

    const [maxSessions, evictionPolicy] = await Promise.all([
      this.authCenterService.getMaxSessions(),
      this.authCenterService.getEvictionPolicyName(),
    ]);
    return { maxSessions, evictionPolicy };
  }

  /**
   * 一键下线其它设备（保留当前会话）
   */
  @Post('sessions/revoke-others')
  @UseGuards(AuthCenterGuard)
  async revokeOtherSessions(@Req() req: any) {
    const userId = req.user?.userId;
    const currentSid = req.user?.sid;
    const revoked = await this.authCenterService.revokeOtherSessions(userId, currentSid);
    return { revoked };
  }

  // ============================================================
  //              管理员视角：跨用户会话管理（新增）
  // ============================================================

  /** 校验 SUPER_ADMIN / admin 权限，否则抛 403 */
  private assertAdmin(req: any) {
    const roles: string[] = req.user?.roleCodes ?? [];
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('admin')) {
      throw new ForbiddenException('权限不足');
    }
  }

  /** 管理员：列出所有有活跃会话的用户（带数量统计） */
  @Get('admin/sessions/users')
  @UseGuards(AuthCenterGuard)
  async adminListUsersWithSessions(
    @Req() req: any,
    @Body() _body: any, // 占位，避免被 ValidationPipe 警告
  ) {
    this.assertAdmin(req);
    const keyword = (req.query?.keyword as string) || '';
    const page = Number.parseInt(req.query?.page, 10) || 1;
    const pageSize = Number.parseInt(req.query?.pageSize, 10) || 20;
    return this.authCenterService.listUsersWithActiveSessions({ keyword, page, pageSize });
  }

  /** 管理员：平铺列出所有活跃会话（带用户详细信息），支持模糊搜索 */
  @Get('admin/sessions')
  @UseGuards(AuthCenterGuard)
  async adminListAllSessions(@Req() req: any) {
    this.assertAdmin(req);
    const keyword = (req.query?.keyword as string) || '';
    const page = Number.parseInt(req.query?.page, 10) || 1;
    const pageSize = Number.parseInt(req.query?.pageSize, 10) || 20;
    return this.authCenterService.listAllActiveSessions({ keyword, page, pageSize });
  }

  /** 管理员：查看任意用户的活跃会话列表 */
  @Get('admin/users/:userId/sessions')
  @UseGuards(AuthCenterGuard)
  async adminListUserSessions(@Req() req: any, @Param('userId') userId: string) {
    this.assertAdmin(req);
    const uid = Number.parseInt(userId, 10);
    if (!Number.isFinite(uid)) throw new NotFoundException('用户不存在');
    const sessions = await this.authCenterService.getUserActiveSessions(uid);
    return { sessions, total: sessions.length, userId: uid };
  }

  /** 管理员：强制下线任意会话（无 userId 校验） */
  @Delete('admin/sessions/:sessionId')
  @UseGuards(AuthCenterGuard)
  async adminRevokeSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    this.assertAdmin(req);
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
      throw new NotFoundException('会话ID无效');
    }
    const ok = await this.authCenterService.revokeSession(sessionId);
    if (!ok) throw new NotFoundException('会话不存在或已下线');
    return { revoked: true, sessionId };
  }

  /** 管理员：一键下线指定用户的全部会话 */
  @Post('admin/users/:userId/sessions/revoke-all')
  @UseGuards(AuthCenterGuard)
  async adminRevokeAllUserSessions(@Req() req: any, @Param('userId') userId: string) {
    this.assertAdmin(req);
    const uid = Number.parseInt(userId, 10);
    if (!Number.isFinite(uid)) throw new NotFoundException('用户不存在');
    const revoked = await this.authCenterService.revokeOtherSessions(uid);
    return { revoked, userId: uid };
  }

  /**
   * 获取SSO配置信息（用于前端调试）
   * 🔥 支持跨域访问，返回 Cookie 信息供前端使用
   */
  @Get('sso-config')
  getSSOConfig(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // 🔥 动态设置 CORS 头部
    const origin = req.headers.origin;
    if (origin && origin.includes('roginx.ink')) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Accept');
    }
    
    const host = req.get('host') || '';
    const cookieDomain = this.getCookieDomain(req);
    
    // 🔥 返回标准格式，兼容您的前端代码
    return {
      code: 200,
      success: true,
      data: {
        currentHost: host,
        cookieDomain,
        environment: process.env.NODE_ENV,
        cookieEnabled: true,
        cookieSecure: process.env.NODE_ENV === 'production',
        cookies: req.cookies || {},  // 🔥 这里包含 sso_access_token 和 sso_refresh_token
      }
    };
  }

  /**
   * 检查是否存在超级管理员
   */
  @Get('check-admin')
  async checkAdmin() {
    const hasAdmin = await this.authCenterService.checkHasAdmin();
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
    const result = await this.authCenterService.initAdmin(data.username, data.password);
    return {
      success: true,
      ...result
    };
  }
}