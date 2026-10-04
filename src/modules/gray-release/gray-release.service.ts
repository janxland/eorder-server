/**
 * 灰度发布服务
 * website: https://www.roginx.ink
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { RedisService } from '@/shared/redis.service';
import {
  CreateGrayReleaseDto,
  BatchBindGrayReleaseDto,
  DeleteGrayReleaseDto,
  BatchDeleteGrayReleaseDto,
  QueryGrayReleaseDto,
  UpdateGrayReleaseDto,
} from './dto';

/**
 * Redis Key 前缀
 * 格式：gray:user:version:{appId}
 */
const GRAY_RELEASE_KEY_PREFIX = 'gray:user:version';

/**
 * 百分比金丝雀策略 Key 前缀
 * 格式：gray:canary:policy:{appId} → {version, weight}
 */
const GRAY_CANARY_POLICY_PREFIX = 'gray:canary:policy';

@Injectable()
export class GrayReleaseService {
  private readonly logger = new Logger(GrayReleaseService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取 Redis Key
   */
  private getRedisKey(appId: string): string {
    return `${GRAY_RELEASE_KEY_PREFIX}:${appId}`;
  }

  /**
   * FNV-1a 32 位哈希：确定性分桶（同身份恒同结果，零依赖）
   */
  private fnv1a32(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * 设置百分比金丝雀策略（weight 0 = 关闭并删除策略）
   */
  async setCanaryPolicy(appId: string, version: string, weight: number): Promise<void> {
    if (weight < 0 || weight > 100) {
      throw new BadRequestException('weight 必须在 0-100 之间');
    }
    const key = `${GRAY_CANARY_POLICY_PREFIX}:${appId}`;
    if (weight <= 0) {
      await this.redisService.del(key);
      return;
    }
    await this.redisService.set(key, JSON.stringify({ version, weight }));
  }

  /**
   * 查询百分比金丝雀策略
   */
  async getCanaryPolicy(appId: string): Promise<{ version: string; weight: number } | null> {
    const raw = await this.redisService.get(`${GRAY_CANARY_POLICY_PREFIX}:${appId}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.version === 'string' && typeof parsed.weight === 'number') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 创建灰度白名单绑定
   */
  async createGrayRelease(dto: CreateGrayReleaseDto) {
    const { appId, userId, version, ttl } = dto;
    const key = this.getRedisKey(appId);

    try {
      // 设置 Hash 字段
      await this.redisService.hSet(key, userId, version);

      // 如果设置了过期时间，设置 Key 的过期时间
      if (ttl && ttl > 0) {
        await this.redisService.expire(key, ttl);
      }

      this.logger.log(`创建灰度白名单绑定: appId=${appId}, userId=${userId}, version=${version}`);

      return {
        appId,
        userId,
        version,
        success: true,
      };
    } catch (error) {
      this.logger.error(`创建灰度白名单绑定失败: ${error.message}`, error.stack);
      throw new BadRequestException(`创建灰度白名单绑定失败: ${error.message}`);
    }
  }

  /**
   * 批量绑定灰度白名单
   */
  async batchBindGrayRelease(dto: BatchBindGrayReleaseDto) {
    const { appId, userIds, version, ttl } = dto;
    const key = this.getRedisKey(appId);

    try {
      const bindings: Record<string, string> = {};
      userIds.forEach((userId) => {
        bindings[userId] = version;
      });

      // 批量设置 Hash 字段
      await this.redisService.hashSet(key, bindings, ttl && ttl > 0 ? ttl : undefined);

      this.logger.log(`批量绑定灰度白名单: appId=${appId}, count=${userIds.length}, version=${version}`);

      return {
        appId,
        userIds,
        version,
        count: userIds.length,
        success: true,
      };
    } catch (error) {
      this.logger.error(`批量绑定灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`批量绑定灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 更新灰度白名单
   */
  async updateGrayRelease(dto: UpdateGrayReleaseDto) {
    const { appId, userId, version, ttl } = dto;
    const key = this.getRedisKey(appId);

    try {
      // 检查是否存在
      const existingVersion = await this.redisService.hGet(key, userId);
      if (!existingVersion) {
        throw new NotFoundException(`未找到用户 ${userId} 的灰度绑定`);
      }

      // 更新版本
      await this.redisService.hSet(key, userId, version);

      // 如果设置了过期时间，更新过期时间
      if (ttl && ttl > 0) {
        await this.redisService.expire(key, ttl);
      }

      this.logger.log(`更新灰度白名单: appId=${appId}, userId=${userId}, version=${version}`);

      return {
        appId,
        userId,
        version,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`更新灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`更新灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 删除灰度白名单
   */
  async deleteGrayRelease(dto: DeleteGrayReleaseDto) {
    const { appId, userId } = dto;
    const key = this.getRedisKey(appId);

    try {
      const deleted = await this.redisService.hDel(key, userId);

      if (deleted === 0) {
        throw new NotFoundException(`未找到用户 ${userId} 的灰度绑定`);
      }

      this.logger.log(`删除灰度白名单: appId=${appId}, userId=${userId}`);

      return {
        appId,
        userId,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`删除灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`删除灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 批量删除灰度白名单
   */
  async batchDeleteGrayRelease(dto: BatchDeleteGrayReleaseDto) {
    const { appId, userIds } = dto;
    const key = this.getRedisKey(appId);

    try {
      const deleted = await this.redisService.hDelMultiple(key, userIds);

      this.logger.log(`批量删除灰度白名单: appId=${appId}, count=${deleted}`);

      return {
        appId,
        userIds,
        deletedCount: deleted,
        success: true,
      };
    } catch (error) {
      this.logger.error(`批量删除灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`批量删除灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 查询灰度白名单
   */
  async queryGrayRelease(dto: QueryGrayReleaseDto) {
    const { appId, userId } = dto;
    const key = this.getRedisKey(appId);

    try {
      if (userId) {
        // 查询单个用户的灰度版本
        const version = await this.redisService.hGet(key, userId);
        if (!version) {
          throw new NotFoundException(`未找到用户 ${userId} 的灰度绑定`);
        }
        return {
          appId,
          userId,
          version,
        };
      } else {
        // 查询应用的所有灰度白名单
        const allBindings = await this.redisService.hashGet(key);
        const bindings = Object.entries(allBindings).map(([uid, ver]) => ({
          userId: uid,
          version: ver,
        }));

        return {
          appId,
          total: bindings.length,
          bindings,
        };
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`查询灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`查询灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 清理应用的所有灰度白名单
   */
  async clearAppGrayRelease(appId: string) {
    const key = this.getRedisKey(appId);

    try {
      await this.redisService.del(key);

      this.logger.log(`清理应用灰度白名单: appId=${appId}`);

      return {
        appId,
        success: true,
      };
    } catch (error) {
      this.logger.error(`清理应用灰度白名单失败: ${error.message}`, error.stack);
      throw new BadRequestException(`清理应用灰度白名单失败: ${error.message}`);
    }
  }

  /**
   * 获取用户的灰度版本（供 Nginx 等外部服务调用）
   * 低耦合设计：不依赖其他模块，仅操作 Redis。
   * 白名单未命中时与 getUserAllGrayVersions 同口径套用百分比金丝雀，
   * 保证两个读取口对同一身份给出同一结论。
   */
  async getUserGrayVersion(appId: string, userId: string): Promise<string | null> {
    const key = this.getRedisKey(appId);
    try {
      const version = await this.redisService.hGet(key, userId);
      if (version) return version;
      const policy = await this.getCanaryPolicy(appId);
      if (policy && policy.weight > 0) {
        const bucket = this.fnv1a32(`${appId}:${userId}`) % 10000;
        if (bucket < policy.weight * 100) {
          return policy.version;
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`获取用户灰度版本失败: ${error.message}`, error.stack);
      // 降级：返回 null，让调用方路由到生产版本
      return null;
    }
  }

  /**
   * 按版本查询用户列表
   * @param appId 应用ID
   * @param version 版本号
   * @returns 用户列表
   */
  async getUsersByVersion(appId: string, version: string) {
    const key = this.getRedisKey(appId);

    try {
      // 获取所有灰度白名单
      const allBindings = await this.redisService.hashGet(key);
      
      // 筛选出指定版本的用户
      const users = Object.entries(allBindings)
        .filter(([_, ver]) => ver === version)
        .map(([userId, _]) => userId);

      return {
        appId,
        version,
        total: users.length,
        users,
      };
    } catch (error) {
      this.logger.error(`按版本查询用户列表失败: ${error.message}`, error.stack);
      throw new BadRequestException(`按版本查询用户列表失败: ${error.message}`);
    }
  }

  /**
   * 获取版本统计信息
   * @param appId 应用ID
   * @returns 版本统计
   */
  async getVersionStats(appId: string) {
    const key = this.getRedisKey(appId);

    try {
      // 获取所有灰度白名单
      const allBindings = await this.redisService.hashGet(key);
      
      // 按版本分组统计
      const versionStats: Record<string, string[]> = {};
      Object.entries(allBindings).forEach(([userId, version]) => {
        if (!versionStats[version]) {
          versionStats[version] = [];
        }
        versionStats[version].push(userId);
      });

      // 转换为数组格式
      const stats = Object.entries(versionStats).map(([version, users]) => ({
        version,
        userCount: users.length,
        users,
      }));

      return {
        appId,
        totalVersions: stats.length,
        totalUsers: Object.keys(allBindings).length,
        stats,
      };
    } catch (error) {
      this.logger.error(`获取版本统计失败: ${error.message}`, error.stack);
      throw new BadRequestException(`获取版本统计失败: ${error.message}`);
    }
  }

  /**
   * 批量获取用户的所有应用灰度版本（一次性查询）
   * @param userId 用户ID
   * @param appIds 应用ID列表（可选，不传则查询所有已知应用）
   * @returns 应用ID到版本号的映射
   */
  async getUserAllGrayVersions(
    userId: string,
    appIds?: string[],
  ): Promise<Record<string, string | null>> {
    // 默认查询所有已知应用（与 scripts/build-center/apps.json 家族注册表对齐）
    const defaultAppIds = [
      'vue-base',
      'vue-app1',
      'vue-app2',
      'vue-app3',
      'vue-build',
      'vue-devops',
    ];
    const targetAppIds = appIds && appIds.length > 0 ? appIds : defaultAppIds;

    try {
      // 并行查询所有应用的灰度版本
      const queries = targetAppIds.map(async (appId) => {
        const key = this.getRedisKey(appId);
        try {
          const version = await this.redisService.hGet(key, userId);
          if (version) return { appId, version };
          // 白名单未命中 → 百分比金丝雀：确定性分桶（同身份恒同结果）
          const policy = await this.getCanaryPolicy(appId);
          if (policy && policy.weight > 0) {
            const bucket = this.fnv1a32(`${appId}:${userId}`) % 10000;
            if (bucket < policy.weight * 100) {
              return { appId, version: policy.version };
            }
          }
          return { appId, version: null };
        } catch (error) {
          this.logger.warn(`查询应用 ${appId} 灰度版本失败: ${error.message}`);
          return { appId, version: null };
        }
      });

      const results = await Promise.all(queries);

      // 转换为对象格式
      const versionMap: Record<string, string | null> = {};
      results.forEach(({ appId, version }) => {
        versionMap[appId] = version;
      });

      return versionMap;
    } catch (error) {
      this.logger.error(`批量获取用户灰度版本失败: ${error.message}`, error.stack);
      // 降级：返回空对象，让调用方使用生产版本
      return {};
    }
  }
}

