import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthCenterService } from '../auth-center.service';

@Injectable()
export class AuthCenterGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authCenterService: AuthCenterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      return false;
    }
    
    const payload = await this.authCenterService.validateAccessToken(token);
    if (!payload) {
      return false;
    }
    
    // 将用户信息附加到请求对象
    request.user = payload;
    
    // 检查角色权限
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }
    
    return requiredRoles.some(role => payload.roleCodes.includes(role));
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}