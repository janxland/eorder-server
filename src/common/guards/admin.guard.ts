/**
 * AdminGuard - 仅放行 SUPER_ADMIN / admin 角色。
 *
 * 设计要点：
 * - 必须放在 AuthCenterGuard 之后使用（依赖 req.user.roleCodes 已经被注入）。
 * - 替代控制器中重复出现的 `assertAdmin(req)` 内联校验，统一权限策略入口。
 *
 * 使用：
 *   @UseGuards(AuthCenterGuard, AdminGuard)
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

const ADMIN_ROLE_CODES = ['SUPER_ADMIN', 'admin'] as const;

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const roles: string[] = req.user?.roleCodes ?? [];
    const ok = ADMIN_ROLE_CODES.some((r) => roles.includes(r));
    if (!ok) throw new ForbiddenException('权限不足');
    return true;
  }
}
