/**
 * website: https://www.roginx.ink
 */

import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '@/modules/user/user.service';
import { PermissionCacheService } from '@/modules/permission/permission-cache.service';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class PermissionCodeGuard implements CanActivate {
  private readonly logger = new Logger(PermissionCodeGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => PermissionCacheService))
    private permissionCacheService: PermissionCacheService,
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
    const { user } = request;

    if (!user || !user.userId) {
      this.logger.warn('用户未认证');
      throw new ForbiddenException('用户未认证');
    }

    // 获取装饰器中要求的权限代码
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    
    // 如果没有要求权限，则放行
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 检查用户是否是超级管理员，超级管理员拥有所有权限
    if (user.roleCodes && user.roleCodes.includes('SUPER_ADMIN')) {
      this.logger.debug(`用户 ${user.username} 是超级管理员，权限检查通过`);
      return true;
    }

    // 使用缓存服务获取用户权限代码（减少数据库查询）
    try {
      const roleCodes = user.roleCodes || [];
      const userPermissionCodes = await this.permissionCacheService.getUserPermissions(
        user.userId,
        roleCodes
      );

      // 检查用户是否拥有任一所需权限
      const hasPermission = requiredPermissions.some(permission => 
        userPermissionCodes.includes(permission)
      );

      if (!hasPermission) {
        this.logger.warn(`用户 ${user.username} 没有所需权限: ${requiredPermissions.join(', ')}`);
        throw new ForbiddenException('权限不足，请联系管理员申请权限');
      }

      this.logger.debug(`用户 ${user.username} 权限检查通过: ${requiredPermissions.join(', ')}`);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`权限检查失败: ${error.message}`);
      throw new ForbiddenException('权限检查失败');
    }
  }
}

