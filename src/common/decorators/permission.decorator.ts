/**
 * website: https://www.roginx.ink
 */

import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../enums/permission-code.enum';

/**
 * 权限装饰器
 * 支持传入权限枚举或字符串
 * @param permissions 权限CODE（枚举或字符串）
 * @returns 元数据装饰器
 */
export const RequirePermission = (...permissions: (PermissionCode | string)[]) => {
  // 枚举值本身就是字符串，直接使用
  return SetMetadata('permissions', permissions);
};


