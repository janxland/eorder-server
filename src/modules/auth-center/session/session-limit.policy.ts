import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * 会话驱逐策略接口（策略模式）
 * 当用户的活跃会话数超过上限时，决定淘汰哪些会话
 */
export interface SessionLimitPolicy {
  /**
   * @param sessions 当前用户全部活跃会话（已按 createdAt 升序）
   * @param maxAllowed 允许保留的最大会话数（保留最新的 maxAllowed - 1 个，给新会话腾位）
   * @returns 需要被驱逐的会话列表
   */
  pickEvictions(sessions: RefreshToken[], maxAllowed: number): RefreshToken[];
}

/**
 * 默认策略：FIFO（按创建时间淘汰最旧）
 * 保留 (maxAllowed - 1) 个最新会话，腾出 1 个位置给即将创建的新会话
 */
export class FifoSessionLimitPolicy implements SessionLimitPolicy {
  pickEvictions(sessions: RefreshToken[], maxAllowed: number): RefreshToken[] {
    if (maxAllowed <= 0) return [];
    // 新会话即将占用 1 个位置，所以现存最多保留 maxAllowed - 1
    const keep = Math.max(0, maxAllowed - 1);
    if (sessions.length < keep) return [];
    return sessions.slice(0, sessions.length - keep);
  }
}

/**
 * LRU 策略：按最近活跃时间淘汰
 */
export class LruSessionLimitPolicy implements SessionLimitPolicy {
  pickEvictions(sessions: RefreshToken[], maxAllowed: number): RefreshToken[] {
    if (maxAllowed <= 0) return [];
    const sorted = [...sessions].sort((a, b) => {
      const ta = (a.lastActiveAt ?? a.createdAt).getTime();
      const tb = (b.lastActiveAt ?? b.createdAt).getTime();
      return ta - tb;
    });
    const keep = Math.max(0, maxAllowed - 1);
    if (sorted.length < keep) return [];
    return sorted.slice(0, sorted.length - keep);
  }
}

export const SESSION_LIMIT_POLICY = Symbol('SESSION_LIMIT_POLICY');
