import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthCenterService } from './auth-center.service';
import { LocalGuard } from '@/common/guards';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { Request } from 'express';

@Controller('auth-center')
export class AuthCenterController {
  private readonly logger = new Logger(AuthCenterController.name);

  constructor(private readonly authCenterService: AuthCenterService) {}

  /**
   * 用户登录
   */
  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
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
    
    return {
      success: true,
      ...result
    };
  }

  /**
   * 刷新访问令牌
   */
  @Post('refresh-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request) {
    const result = await this.authCenterService.refreshToken(refreshTokenDto.refreshToken, req);
    return {
      success: true,
      ...result
    };
  }

  /**
   * 登出系统
   */
  @Post('logout')
  @UseGuards(AuthCenterGuard)
  async logout(@Req() req: any) {
    const userId = req.user?.userId;
    const result = await this.authCenterService.logout(userId, req);
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
   * 验证token有效性
   */
  @Post('verify-token')
  async verifyToken(@Body() body: { token: string }) {
    const result = await this.authCenterService.verifyToken(body.token);
    return {
      success: true,
      ...result
    };
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