import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthCenterService } from './auth-center.service';
import { LocalGuard, JwtGuard } from '@/common/guards';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth-center')
export class AuthCenterController {
  constructor(private readonly authCenterService: AuthCenterService) {}

  @UseGuards(LocalGuard)
  @Post('login')
  async login(@Req() req: any, @Body() loginDto: LoginDto) {
    return this.authCenterService.login(req.user, req);
  }

  @Post('refresh')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authCenterService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  async logout(@Req() req: any) {
    return this.authCenterService.revokeAllUserTokens(req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Get('sessions')
  async getUserSessions(@Req() req: any) {
    return this.authCenterService.getUserActiveSessions(req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @Req() req: any) {
    // 这里需要添加额外的安全检查，确保用户只能撤销自己的会话
    const session = await this.authCenterService.revokeRefreshToken(id);
    return { success: !!session };
  }
}