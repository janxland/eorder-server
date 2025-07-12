import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthCenterService } from '@/modules/auth-center/auth-center.service';

@Injectable()
export class AuthCenterGuard implements CanActivate {
  private readonly logger = new Logger(AuthCenterGuard.name);

  constructor(
    private authCenterService: AuthCenterService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      this.logger.warn('请求未提供访问令牌');
      throw new UnauthorizedException('未提供访问令牌');
    }
    
    try {
      const payload = await this.authCenterService.validateAccessToken(token);
      
      if (!payload) {
        this.logger.warn('访问令牌无效或已过期');
        throw new UnauthorizedException('访问令牌无效或已过期');
      }
      
      // 将用户信息附加到请求对象
      request.user = payload;
      this.logger.debug(`用户认证成功: userId=${payload.userId}, username=${payload.username}`);
      
      return true;
    } catch (error) {
      this.logger.error(`认证失败: ${error.message}`);
      throw new UnauthorizedException('认证失败: ' + error.message);
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    // 尝试从标准Authorization头获取
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }
    
    // 尝试从自定义头获取
    const customToken = request.headers['x-auth-token'];
    if (customToken) {
      return customToken;
    }
    
    // 尝试从查询参数获取
    const queryToken = request.query.token;
    if (queryToken) {
      return queryToken;
    }
    
    return undefined;
  }
} 