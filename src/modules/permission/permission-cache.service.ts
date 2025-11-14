/**
 * 权限缓存服务
 * 使用 Redis 缓存角色-权限码映射，减少数据库查询
 * website: https://www.roginx.ink
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from '@/shared/redis.service';
import { PermissionService } from './permission.service';
import { RoleService } from '@/modules/role/role.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@/modules/role/role.entity';

@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);
  
  // Redis Key 前缀
  private readonly ROLE_PERMISSIONS_KEY_PREFIX = 'role:permissions:';
  private readonly USER_PERMISSIONS_KEY_PREFIX = 'user:permissions:';
  
  // 缓存过期时间（秒）- 默认 1 小时
  private readonly CACHE_TTL = 3600;

  constructor(
    @Inject(RedisService)
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => PermissionService))
    private readonly permissionService: PermissionService,
    @Inject(forwardRef(() => RoleService))
    private readonly roleService: RoleService,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /**
   * 获取角色的权限码列表（带缓存）
   * @param roleCode 角色代码
   * @returns 权限码数组
   */
  async getRolePermissions(roleCode: string): Promise<string[]> {
    const cacheKey = `${this.ROLE_PERMISSIONS_KEY_PREFIX}${roleCode}`;
    
    try {
      // 尝试从缓存获取
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`从缓存获取角色权限: ${roleCode}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`读取角色权限缓存失败: ${error.message}`);
    }

    // 缓存未命中，从数据库查询
    try {
      // 查找角色（通过 code）
      const role = await this.roleRepo.findOne({ where: { code: roleCode } });
      if (!role) {
        this.logger.warn(`角色不存在: ${roleCode}`);
        return [];
      }

      // 获取角色的所有权限（扁平化）
      const permissions = await this.roleService.findRolePermissions(role.id);
      const permissionCodes = permissions.map(p => p.code);

      // 写入缓存
      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(permissionCodes),
          this.CACHE_TTL
        );
        this.logger.debug(`角色权限已缓存: ${roleCode}`);
      } catch (error) {
        this.logger.warn(`写入角色权限缓存失败: ${error.message}`);
      }

      return permissionCodes;
    } catch (error) {
      this.logger.error(`查询角色权限失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取用户的权限码列表（带缓存）
   * @param userId 用户ID
   * @param roleCodes 用户角色代码数组
   * @returns 权限码数组
   */
  async getUserPermissions(userId: number, roleCodes: string[]): Promise<string[]> {
    const cacheKey = `${this.USER_PERMISSIONS_KEY_PREFIX}${userId}`;
    
    try {
      // 尝试从缓存获取
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`从缓存获取用户权限: userId=${userId}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`读取用户权限缓存失败: ${error.message}`);
    }

    // 缓存未命中，从数据库查询
    try {
      // 收集所有角色的权限
      const allPermissions = new Set<string>();
      
      for (const roleCode of roleCodes) {
        const rolePermissions = await this.getRolePermissions(roleCode);
        rolePermissions.forEach(code => allPermissions.add(code));
      }

      const permissionCodes = Array.from(allPermissions);

      // 写入缓存
      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(permissionCodes),
          this.CACHE_TTL
        );
        this.logger.debug(`用户权限已缓存: userId=${userId}`);
      } catch (error) {
        this.logger.warn(`写入用户权限缓存失败: ${error.message}`);
      }

      return permissionCodes;
    } catch (error) {
      this.logger.error(`查询用户权限失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 清除角色权限缓存
   * @param roleCode 角色代码
   */
  async clearRolePermissionsCache(roleCode: string): Promise<void> {
    const cacheKey = `${this.ROLE_PERMISSIONS_KEY_PREFIX}${roleCode}`;
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(`已清除角色权限缓存: ${roleCode}`);
    } catch (error) {
      this.logger.warn(`清除角色权限缓存失败: ${error.message}`);
    }
  }

  /**
   * 清除用户权限缓存
   * @param userId 用户ID
   */
  async clearUserPermissionsCache(userId: number): Promise<void> {
    const cacheKey = `${this.USER_PERMISSIONS_KEY_PREFIX}${userId}`;
    try {
      await this.redisService.del(cacheKey);
      this.logger.debug(`已清除用户权限缓存: userId=${userId}`);
    } catch (error) {
      this.logger.warn(`清除用户权限缓存失败: ${error.message}`);
    }
  }

  /**
   * 清除所有权限缓存（当权限或角色变更时调用）
   */
  async clearAllPermissionsCache(): Promise<void> {
    // 注意：这里需要遍历所有相关的 key，实际实现可能需要使用 Redis 的 SCAN 命令
    // 或者维护一个 key 列表
    this.logger.warn('清除所有权限缓存功能需要实现 key 遍历逻辑');
  }
}

