import { Injectable, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, MoreThan, Not, IsNull } from 'typeorm';
import { compareSync } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserService } from '../user/user.service';
import { RedisService } from '@/shared/redis.service';
import { CustomException, ErrorCode } from '@/common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';
import { User } from '@/modules/user/user.entity';
import { Profile } from '@/modules/user/profile.entity';
import { Role } from '@/modules/role/role.entity';
import * as bcrypt from 'bcryptjs';
import { DeviceParser } from './utils/device-parser.util';
import { ClientIpExtractor } from './utils/client-ip.util';
import { OriginExtractor } from './utils/origin.util';
import {
  FifoSessionLimitPolicy,
  LruSessionLimitPolicy,
  SessionLimitPolicy,
} from './session/session-limit.policy';

@Injectable()
export class AuthCenterService {
  // Access Token过期时间（6小时）
  private readonly ACCESS_TOKEN_EXPIRATION = 60 * 60 * 6;
  // Refresh Token过期时间（3个月）
  private readonly REFRESH_TOKEN_EXPIRATION = 90 * 24 * 60 * 60;

  // === 多端会话相关常量 ===
  /** 默认最大并发会话数 */
  private readonly DEFAULT_MAX_SESSIONS = 3;
  /** 允许配置的会话上限范围 */
  private readonly MIN_SESSIONS = 1;
  private readonly MAX_SESSIONS_LIMIT = 20;
  /** Redis 配置 key：最大并发会话数 */
  private readonly KEY_MAX_SESSIONS = 'auth:config:max_sessions';
  /** Redis 配置 key：驱逐策略（fifo|lru） */
  private readonly KEY_EVICTION_POLICY = 'auth:config:eviction_policy';

  /** 策略注册表（策略模式 + 工厂） */
  private readonly policyRegistry: Record<string, SessionLimitPolicy> = {
    fifo: new FifoSessionLimitPolicy(),
    lru: new LruSessionLimitPolicy(),
  };

  private readonly logger = new Logger(AuthCenterService.name);


  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private redisService: RedisService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  /**
   * 用户注册
   */
  async register(username: string, password: string, email?: string) {
    this.logger.debug(`尝试注册用户: ${username}`);
    
    // 检查用户名是否已存在
    const existingUser = await this.userService.findByUsername(username);
    if (existingUser) {
      throw new CustomException(ErrorCode.ERR_11001); // 用户已存在
    }
    
    // 创建新用户
    const user = new User();
    user.username = username;
    user.password = password; // 直接存储密码，与现有系统保持一致
    user.enable = true;
    
    // 如果提供了邮箱，创建用户资料
    if (email) {
      user.profile = {
        email: email,
        nickname: username,
        avatar: null,
        phone: null,
        address: null,
        birthday: null,
        gender: null,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any;
    }
    
    // 查找默认角色（如果有的话）
    const defaultRole = await this.roleRepository.findOne({
      where: { code: 'user' } // 假设有一个默认的user角色
    });
    
    if (defaultRole) {
      user.roles = [defaultRole];
    }
    
    // 保存用户
    const savedUser = await this.userRepository.save(user);
    
    this.logger.debug(`用户注册成功: ${username}, ID: ${savedUser.id}`);
    
    return {
      userId: savedUser.id,
      username: savedUser.username,
      message: '注册成功'
    };
  }

  /**
   * 验证用户凭据
   */
  async validateUser(username: string, password: string) {
    this.logger.debug(`尝试验证用户: ${username}`);
    
    const user = await this.userService.findByUsername(username);
    
    if (!user) {
      this.logger.debug(`用户不存在: ${username}`);
      return null;
    }
    
    this.logger.debug(`找到用户: ${username}, ID: ${user.id}`);
    this.logger.debug(`数据库密码: ${user.password}`);
    this.logger.debug(`密码比较结果: ${user.password === password ? '匹配' : '不匹配'}`);
    
    // 直接比较密码，不使用bcrypt
    if (user && user.password === password) {
      this.logger.debug(`用户 ${username} 验证成功`);
      const { password, ...result } = user;
      return result;
    }
    
    this.logger.debug(`用户 ${username} 验证失败`);
    return null;
  }

  /**
   * 用户登录
   * SSO模式：即使用户没有启用的角色，也允许登录并生成token
   * 具体权限检查由各个应用自行处理
   */
  async login(user: any, req: any) {
    const roleCodes = user.roles?.filter((item) => item.enable).map((item) => item.code) || [];
    const currentRole = user.roles?.find((item) => item.enable) || { code: 'guest' };
    
    const tokens = await this.generateTokens({
      userId: user.id,
      username: user.username,
      roleCodes,
      currentRoleCode: currentRole.code,
    }, req);

    return tokens;
  }

  /**
   * 生成Access Token和Refresh Token
   * 多端会话：每次登录创建独立 sessionId，超过上限则按策略驱逐最旧会话
   */
  async generateTokens(payload: any, req?: any) {
    const userAgent = req?.headers?.['user-agent'];
    const ipAddress = ClientIpExtractor.extract(req);
    const origin = OriginExtractor.extract(req);

    // 1. 同设备幂等：若已有活跃会话来自完全相同的 userAgent + ip，
    //    视为"同一物理设备的重复登录"，撤销旧会话后再创建新会话，
    //    避免同一浏览器反复打开登录页导致会话数虚高。
    if (userAgent) {
      await this.revokeSessionsForSameDevice(payload.userId, userAgent, ipAddress);
    }

    // 2. 在新建会话之前先执行驱逐策略（限制并发设备数）
    await this.enforceSessionLimit(payload.userId);

    // 3. 创建会话标识
    const sessionId = uuidv4();
    const deviceName = DeviceParser.parse(userAgent);
    const now = new Date();

    // 4. 生成 Access Token（携带 sid 用于会话隔离）
    const tokenPayload = { ...payload, sid: sessionId };
    const accessToken = this.jwtService.sign(tokenPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });

    // 5. 生成 Refresh Token
    const refreshToken = uuidv4();
    const expiresAt = new Date(now.getTime() + this.REFRESH_TOKEN_EXPIRATION * 1000);

    // 6. 并行写入：DB（refresh token） + Redis（access token & last_active）
    await Promise.all([
      this.refreshTokenRepository.save({
        token: refreshToken,
        sessionId,
        expiresAt,
        userId: payload.userId,
        userAgent,
        ipAddress,
        origin,
        deviceName,
        lastActiveAt: now,
      }),
      this.redisService.set(
        this.accessTokenKey(payload.userId, sessionId),
        accessToken,
        this.ACCESS_TOKEN_EXPIRATION,
      ),
      this.redisService.set(
        `auth:last_active:${payload.userId}`,
        now.toISOString(),
        this.REFRESH_TOKEN_EXPIRATION,
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
      tokenType: 'Bearer',
      userId: payload.userId,
      username: payload.username,
      roles: payload.roleCodes,
    };
  }

  /**
   * 使用Refresh Token刷新Access Token
   */
  async refreshToken(refreshTokenString: string, req: any) {
    // 查找Refresh Token
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString, isRevoked: false },
    });

    // 验证Refresh Token
    if (!refreshTokenEntity) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    // 检查是否过期
    if (new Date() > refreshTokenEntity.expiresAt) {
      // 标记为已撤销
      refreshTokenEntity.isRevoked = true;
      await this.refreshTokenRepository.save(refreshTokenEntity);
      throw new UnauthorizedException('刷新令牌已过期');
    }

    // 获取用户信息
    const user = await this.userService.findUserProfile(refreshTokenEntity.userId);
    if (!user || !user.enable) {
      throw new UnauthorizedException('用户已禁用');
    }

    const roleCodes = user.roles?.map((item) => item.code);
    const currentRole = user.roles.find(role => role.enable) || user.roles[0];

    // 沿用原 sessionId（保持会话连续性）
    const sessionId = refreshTokenEntity.sessionId || uuidv4();
    const now = new Date();

    // 生成新的Access Token，但保留原有的Refresh Token
    const accessToken = this.jwtService.sign({
      userId: user.id,
      username: user.username,
      roleCodes,
      currentRoleCode: currentRole.code,
      sid: sessionId,
    }, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });

    // 同步新 token、活跃时间（并行）
    refreshTokenEntity.lastActiveAt = now;
    if (!refreshTokenEntity.sessionId) {
      refreshTokenEntity.sessionId = sessionId;
    }
    await Promise.all([
      this.redisService.set(
        this.accessTokenKey(user.id, sessionId),
        accessToken,
        this.ACCESS_TOKEN_EXPIRATION,
      ),
      this.refreshTokenRepository.save(refreshTokenEntity),
      this.redisService.set(
        `auth:last_active:${user.id}`,
        now.toISOString(),
        this.REFRESH_TOKEN_EXPIRATION,
      ),
    ]);

    return {
      accessToken,
      refreshToken: refreshTokenString,
      sessionId,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
      tokenType: 'Bearer',
      userId: user.id,
      username: user.username,
      roles: roleCodes,
    };
  }

  /**
   * 登出系统
   */
  async logout(userId: number, req: any) {
    // 获取当前使用的Refresh Token
    const refreshToken = req.headers['x-refresh-token'];
    if (refreshToken) {
      // 撤销特定的Refresh Token
      await this.revokeRefreshToken(refreshToken);
    } else {
      // 如果没有提供Refresh Token，则撤销所有Token
      await this.revokeAllUserTokens(userId);
    }

    return { success: true, message: '登出成功' };
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId: number) {
    const user = await this.userService.findUserProfile(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 更新最后活跃时间
    await this.redisService.set(
      `auth:last_active:${userId}`,
      new Date().toISOString(),
      this.REFRESH_TOKEN_EXPIRATION,
    );

    return {
      id: user.id,
      username: user.username,
      email: user.profile?.email,
      roles: user.roles?.map(role => ({
        code: role.code,
        name: role.name,
      })),
      lastActive: await this.redisService.get(`auth:last_active:${userId}`),
    };
  }

  /**
   * 验证Token有效性
   */
  async verifyToken(token: string) {
    try {
      const payload = await this.validateAccessToken(token);
      if (!payload) {
        return { valid: false };
      }
      return { 
        valid: true,
        userId: payload.userId,
        username: payload.username,
        roles: payload.roleCodes,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * 撤销用户的所有Token（所有设备登出）
   */
  async revokeAllUserTokens(userId: number) {
    // 找出所有未撤销会话，逐一清理 Redis
    const sessions = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      select: ['id', 'sessionId'],
    });

    await Promise.all(
      sessions
        .filter((s) => !!s.sessionId)
        .map((s) => this.redisService.del(this.accessTokenKey(userId, s.sessionId))),
    );

    // 兼容旧版用户级 key
    await this.redisService.del(`auth:access_token:${userId}`);

    // 数据库批量撤销
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    return true;
  }

  /**
   * 撤销特定的Refresh Token（当前设备登出）
   */
  async revokeRefreshToken(refreshTokenString: string) {
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
    });
    if (!token) return false;

    token.isRevoked = true;
    await this.refreshTokenRepository.save(token);

    if (token.sessionId) {
      await this.redisService.del(this.accessTokenKey(token.userId, token.sessionId));
    } else {
      // 兼容旧数据
      await this.redisService.del(`auth:access_token:${token.userId}`);
    }
    return true;
  }

  /**
   * 验证Access Token：基于 sid 做会话级匹配
   */
  async validateAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      // 旧版 token 没有 sid，强制重登（避免单点共享 key 的安全风险）
      if (!payload.sid) {
        // 软兼容：仍然按旧 key 比对一次，方便平滑升级期内已登录的用户
        const legacy = await this.redisService.get(`auth:access_token:${payload.userId}`);
        return legacy && legacy === token ? payload : null;
      }

      const stored = await this.redisService.get(
        this.accessTokenKey(payload.userId, payload.sid),
      );
      if (token !== stored) return null;
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * 获取用户的所有活跃会话（按创建时间倒序）
   */
  async getUserActiveSessions(userId: number, currentSessionId?: string) {
    const sessions = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
        // 过滤掉旧版无 sessionId 的脏数据，避免前端拿到 null 拼出
        // /sessions/null 这种坏 URL
        sessionId: Not(IsNull()),
      },
      select: [
        'id',
        'sessionId',
        'userAgent',
        'ipAddress',
        'origin',
        'deviceName',
        'createdAt',
        'expiresAt',
        'lastActiveAt',
      ],
      order: { createdAt: 'DESC' },
    });

    return sessions.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      deviceName: s.deviceName || DeviceParser.parse(s.userAgent),
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      origin: s.origin,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastActiveAt: s.lastActiveAt ?? s.createdAt,
      isCurrent: !!currentSessionId && s.sessionId === currentSessionId,
    }));
  }

  /**
   * 管理员视角：分页/搜索查询当前有活跃会话的用户列表
   * 返回 [{ userId, username, nickname, sessionCount, lastActiveAt }]
   */
  async listUsersWithActiveSessions(params: {
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { keyword = '', page = 1, pageSize = 20 } = params || {};
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 20));

    // 先聚合得到 userId -> count / lastActive
    const qb = this.refreshTokenRepository
      .createQueryBuilder('rt')
      .select('rt.userId', 'userId')
      .addSelect('COUNT(rt.id)', 'sessionCount')
      .addSelect('MAX(rt.lastActiveAt)', 'lastActiveAt')
      .where('rt.isRevoked = :revoked', { revoked: false })
      .andWhere('rt.expiresAt > :now', { now: new Date() })
      .andWhere('rt.sessionId IS NOT NULL')
      .groupBy('rt.userId')
      .orderBy('lastActiveAt', 'DESC');

    const aggregates = await qb.getRawMany<{
      userId: number;
      sessionCount: string;
      lastActiveAt: Date | null;
    }>();
    if (aggregates.length === 0) {
      return { list: [], total: 0, page: safePage, pageSize: safeSize };
    }

    // 关联用户信息（一次性 IN 查询）
    const userIds = aggregates.map((a) => Number(a.userId));
    const users = await this.userRepository.find({
      where: { id: In(userIds) },
      select: ['id', 'username'] as any,
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 合并 + 关键字过滤（用户名/昵称/userId）
    const kw = keyword.trim().toLowerCase();
    const merged = aggregates
      .map((a) => {
        const u = userMap.get(Number(a.userId));
        return {
          userId: Number(a.userId),
          username: u?.username || '',
          sessionCount: Number(a.sessionCount),
          lastActiveAt: a.lastActiveAt,
        };
      })
      .filter((row) => {
        if (!kw) return true;
        return (
          String(row.userId).includes(kw) ||
          row.username.toLowerCase().includes(kw)
        );
      });

    const total = merged.length;
    const list = merged.slice((safePage - 1) * safeSize, safePage * safeSize);
    return { list, total, page: safePage, pageSize: safeSize };
  }

  /**
   * 管理员视角：平铺列出所有活跃会话，附带用户详细信息
   * 支持按 username / nickname / userId / IP / 设备 / sessionId 模糊检索
   */
  async listAllActiveSessions(params: {
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { keyword = '', page = 1, pageSize = 20 } = params || {};
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 20));

    const qb = this.refreshTokenRepository
      .createQueryBuilder('rt')
      .innerJoin(User, 'u', 'u.id = rt.userId')
      .leftJoin(Profile, 'p', 'p.userId = rt.userId')
      .select([
        'rt.id AS id',
        'rt.sessionId AS sessionId',
        'rt.userId AS userId',
        'rt.userAgent AS userAgent',
        'rt.ipAddress AS ipAddress',
        'rt.origin AS origin',
        'rt.deviceName AS deviceName',
        'rt.createdAt AS createdAt',
        'rt.expiresAt AS expiresAt',
        'rt.lastActiveAt AS lastActiveAt',
        'u.username AS username',
        'u.enable AS userEnable',
        'p.nickName AS nickName',
        'p.avatar AS avatar',
        'p.email AS email',
      ])
      .where('rt.isRevoked = :revoked', { revoked: false })
      .andWhere('rt.expiresAt > :now', { now: new Date() })
      .andWhere('rt.sessionId IS NOT NULL');

    const kw = keyword.trim();
    if (kw) {
      qb.andWhere(
        `(u.username LIKE :kw OR p.nickName LIKE :kw OR rt.ipAddress LIKE :kw
          OR rt.deviceName LIKE :kw OR rt.origin LIKE :kw OR rt.sessionId LIKE :kw OR CAST(rt.userId AS CHAR) LIKE :kw)`,
        { kw: `%${kw}%` },
      );
    }

    qb.orderBy('rt.lastActiveAt', 'DESC').addOrderBy('rt.createdAt', 'DESC');

    const total = await qb.getCount();
    const rows = await qb
      .offset((safePage - 1) * safeSize)
      .limit(safeSize)
      .getRawMany();

    const list = rows.map((r) => ({
      id: Number(r.id),
      sessionId: r.sessionId,
      userId: Number(r.userId),
      username: r.username || '',
      nickName: r.nickName || '',
      avatar: r.avatar || '',
      email: r.email || '',
      userEnable: r.userEnable === 1 || r.userEnable === true,
      deviceName: r.deviceName || DeviceParser.parse(r.userAgent),
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      origin: r.origin || '',
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      lastActiveAt: r.lastActiveAt ?? r.createdAt,
    }));

    return { list, total, page: safePage, pageSize: safeSize };
  }

  // ============================================================
  //                    多端会话管理（新增）
  // ============================================================

  /** Redis: 按会话维度的 access token key */
  private accessTokenKey(userId: number | string, sessionId: string) {
    return `auth:access_token:${userId}:${sessionId}`;
  }

  /**
   * 获取最大并发会话数（默认 3，可在前端设置）
   */
  async getMaxSessions(): Promise<number> {
    const v = await this.redisService.get(this.KEY_MAX_SESSIONS);
    if (!v) return this.DEFAULT_MAX_SESSIONS;
    const parsed = Number.parseInt(String(v), 10);
    if (!Number.isInteger(parsed)) return this.DEFAULT_MAX_SESSIONS;
    return Math.min(this.MAX_SESSIONS_LIMIT, Math.max(this.MIN_SESSIONS, parsed));
  }

  /**
   * 设置最大并发会话数
   */
  async setMaxSessions(value: number): Promise<number> {
    const num = Number.parseInt(String(value), 10);
    if (!Number.isInteger(num)) {
      throw new CustomException(ErrorCode.ERR_10000);
    }
    const normalized = Math.min(
      this.MAX_SESSIONS_LIMIT,
      Math.max(this.MIN_SESSIONS, num),
    );
    await this.redisService.set(this.KEY_MAX_SESSIONS, String(normalized));
    return normalized;
  }

  /**
   * 获取当前驱逐策略名（fifo / lru）
   */
  async getEvictionPolicyName(): Promise<'fifo' | 'lru'> {
    const v = (await this.redisService.get(this.KEY_EVICTION_POLICY)) as
      | 'fifo'
      | 'lru'
      | null;
    return v && this.policyRegistry[v] ? v : 'fifo';
  }

  /**
   * 设置驱逐策略
   */
  async setEvictionPolicy(name: 'fifo' | 'lru'): Promise<'fifo' | 'lru'> {
    if (!this.policyRegistry[name]) {
      throw new CustomException(ErrorCode.ERR_10000);
    }
    await this.redisService.set(this.KEY_EVICTION_POLICY, name);
    return name;
  }

  /**
   * 强制执行会话上限：超过则按策略驱逐
   */
  private async enforceSessionLimit(userId: number) {
    const [maxSessions, policyName] = await Promise.all([
      this.getMaxSessions(),
      this.getEvictionPolicyName(),
    ]);
    const policy = this.policyRegistry[policyName];

    const sessions = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
    });

    const evictions = policy.pickEvictions(sessions, maxSessions);
    if (evictions.length === 0) return;

    this.logger.log(
      `用户 ${userId} 会话超限（${sessions.length}/${maxSessions}），策略=${policyName}，驱逐 ${evictions.length} 个会话`,
    );

    // DB 批量撚销 + Redis 并行清理
    const evictedIds = evictions.map((s) => s.id);
    await Promise.all([
      this.refreshTokenRepository.update({ id: In(evictedIds) }, { isRevoked: true }),
      ...evictions
        .filter((s) => !!s.sessionId)
        .map((s) => this.redisService.del(this.accessTokenKey(userId, s.sessionId))),
    ]);
  }

  /**
   * 同设备幂等去重：同一 (userId + userAgent + ipAddress) 的旧会话视为
   * 同一物理设备的重复登录，登录时静默撤销，避免会话数虚高。
   */
  private async revokeSessionsForSameDevice(
    userId: number,
    userAgent: string,
    ipAddress?: string,
  ): Promise<void> {
    const where: any = {
      userId,
      userAgent,
      isRevoked: false,
      expiresAt: MoreThan(new Date()),
    };
    if (ipAddress) where.ipAddress = ipAddress;

    const dupes = await this.refreshTokenRepository.find({
      where,
      select: ['id', 'sessionId'],
    });
    if (dupes.length === 0) return;

    this.logger.log(
      `用户 ${userId} 同设备重复登录，撤销 ${dupes.length} 个旧会话 (UA=${userAgent?.slice(0, 60)}..., IP=${ipAddress})`,
    );

    await Promise.all([
      this.refreshTokenRepository.update(
        { id: In(dupes.map((d) => d.id)) },
        { isRevoked: true },
      ),
      ...dupes
        .filter((d) => !!d.sessionId)
        .map((d) => this.redisService.del(this.accessTokenKey(userId, d.sessionId))),
    ]);
  }

  async revokeSession(sessionId: string, requireUserId?: number) {
    if (!sessionId || sessionId === 'null' || sessionId === 'undefined') return false;
    const where: any = { sessionId };
    if (requireUserId != null) where.userId = requireUserId;

    const token = await this.refreshTokenRepository.findOne({ where });
    if (!token || token.isRevoked) return false;

    // DB + Redis 并行
    await Promise.all([
      this.refreshTokenRepository.update({ id: token.id }, { isRevoked: true }),
      token.sessionId
        ? this.redisService.del(this.accessTokenKey(token.userId, token.sessionId))
        : Promise.resolve(),
    ]);
    return true;
  }

  /**
   * 撤销当前用户除指定会话外的所有会话（一键下线其它设备）
   * 单 SQL 批量更新 + Redis 并行清理
   */
  async revokeOtherSessions(userId: number, keepSessionId?: string): Promise<number> {
    const where: any = {
      userId,
      isRevoked: false,
      expiresAt: MoreThan(new Date()),
    };
    if (keepSessionId) {
      where.sessionId = Not(keepSessionId);
    }

    const targets = await this.refreshTokenRepository.find({
      where,
      select: ['id', 'sessionId'],
    });
    if (targets.length === 0) return 0;

    await Promise.all([
      this.refreshTokenRepository.update(
        { id: In(targets.map((t) => t.id)) },
        { isRevoked: true },
      ),
      ...targets
        .filter((t) => !!t.sessionId)
        .map((t) => this.redisService.del(this.accessTokenKey(userId, t.sessionId))),
    ]);
    return targets.length;
  }

  /**
   * 触达：刷新会话最近活跃时间（轻量）
   */
  async touchSession(sessionId: string) {
    if (!sessionId) return;
    await this.refreshTokenRepository.update(
      { sessionId, isRevoked: false },
      { lastActiveAt: new Date() },
    );
  }

  /**
   * 检查是否存在超级管理员
   * @returns 是否存在超级管理员
   */
  async checkHasAdmin(): Promise<boolean> {
    try {
      // 查询是否存在角色为admin的用户
      const adminCount = await this.userRepository.count({
        where: { roles: { code: 'admin' } },
        relations: ['roles'],
      });
      
      return adminCount > 0;
    } catch (error) {
      this.logger.error(`检查超级管理员失败: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 初始化超级管理员
   * @param username 用户名
   * @param password 密码
   * @returns 初始化结果
   */
  async initAdmin(username: string, password: string): Promise<any> {
    try {
      // 检查是否已存在超级管理员
      const hasAdmin = await this.checkHasAdmin();
      if (hasAdmin) {
        throw new Error('已存在超级管理员账号，无需重复初始化');
      }
      
      // 创建超级管理员账号
      const user = new User();
      user.username = username;
      user.password = password;
      user.enable = true;
      
      // 查找或创建admin角色
      let adminRole = await this.roleRepository.findOne({
        where: { code: 'admin' }
      });
      
      if (!adminRole) {
        adminRole = new Role();
        adminRole.code = 'admin';
        adminRole.name = '超级管理员';
        adminRole.enable = true;
        adminRole = await this.roleRepository.save(adminRole);
      }
      
      // 设置用户角色
      user.roles = [adminRole];
      
      // 保存用户
      const savedUser = await this.userRepository.save(user);
      
      // 生成登录凭证
      const tokens = await this.generateTokens(savedUser);
      
      // 返回结果
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: savedUser.id,
          username: savedUser.username,
          roles: ['admin']
        }
      };
    } catch (error) {
      this.logger.error(`初始化超级管理员失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 密码加密
   * @param password 原始密码
   * @returns 加密后的密码
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }
}