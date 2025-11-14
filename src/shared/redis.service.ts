/**
 * website: https://www.roginx.ink
 */

import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  @Inject('REDIS_CLIENT')
  private redisClient: RedisClientType;

  async get(key: string) {
    return await this.redisClient.get(key);
  }

  async set(key: string, value: string | number, ttl?: number) {
    await this.redisClient.set(key, value);

    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
  }

  async del(key: string) {
    await this.redisClient.del(key);
    return true;
  }

  async hashGet(key: string) {
    return await this.redisClient.hGetAll(key);
  }

  async hashSet(key: string, obj: Record<string, any>, ttl?: number) {
    for (const name in obj) {
      await this.redisClient.hSet(key, name, obj[name]);
    }

    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
  }

  /**
   * 获取 Hash 字段值
   * @param key Hash key
   * @param field 字段名
   * @returns 字段值
   */
  async hGet(key: string, field: string) {
    return await this.redisClient.hGet(key, field);
  }

  /**
   * 设置 Hash 字段值
   * @param key Hash key
   * @param field 字段名
   * @param value 字段值
   */
  async hSet(key: string, field: string, value: string) {
    await this.redisClient.hSet(key, field, value);
  }

  /**
   * 删除 Hash 字段
   * @param key Hash key
   * @param field 字段名
   * @returns 删除的字段数量
   */
  async hDel(key: string, field: string) {
    return await this.redisClient.hDel(key, field);
  }

  /**
   * 批量删除 Hash 字段
   * @param key Hash key
   * @param fields 字段名数组
   * @returns 删除的字段数量
   */
  async hDelMultiple(key: string, fields: string[]) {
    if (fields.length === 0) return 0;
    return await this.redisClient.hDel(key, fields);
  }

  /**
   * 设置 Key 的过期时间
   * @param key Key
   * @param ttl 过期时间（秒）
   * @returns 是否设置成功
   */
  async expire(key: string, ttl: number) {
    return await this.redisClient.expire(key, ttl);
  }
}
