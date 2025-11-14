import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthCenterService } from '@/modules/auth-center/auth-center.service';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class AuthCenterGuard implements CanActivate {
  private readonly logger = new Logger(AuthCenterGuard.name);

  constructor(
    @Inject(forwardRef(() => AuthCenterService))
    private authCenterService: AuthCenterService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否是公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
        throw new UnauthorizedException('登录已过期');
      }
      
      // 将用户信息附加到请求对象
      request.user = payload;
      this.logger.debug(`用户认证成功: userId=${payload.userId}, username=${payload.username}`);
      
      // 检查是否有 X-Required-Role 头部
      const requiredRole = request.headers['x-required-role'];
      if (requiredRole) {
        this.logger.debug(`检查必需角色: ${requiredRole}`);
        
        // 检查用户是否有所需角色
        if (!payload.roleCodes || !payload.roleCodes.includes(requiredRole)) {
          this.logger.warn(`用户 ${payload.username} 没有所需角色: ${requiredRole}`);
          throw new ForbiddenException('权限不足，请联系管理员申请权限');
        }
        
        // 角色检查通过，设置当前角色
        payload.currentRoleCode = requiredRole;
      } else {
        // 如果没有指定特定角色，使用用户的第一个角色
        if (payload.roleCodes && payload.roleCodes.length > 0) {
          payload.currentRoleCode = payload.roleCodes[0];
        }
      }
      
      // 检查装饰器中的角色要求
      const roles = this.reflector.get<string[]>('roles', context.getHandler());
      if (roles && roles.length > 0) {
        this.logger.debug(`检查装饰器角色: ${roles.join(', ')}`);
        
        const hasRole = roles.some(role => payload.roleCodes.includes(role));
        if (!hasRole) {
          this.logger.warn(`用户 ${payload.username} 没有所需角色: ${roles.join(', ')}`);
          throw new ForbiddenException('权限不足，请联系管理员申请权限');
        }
      }
      
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      
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