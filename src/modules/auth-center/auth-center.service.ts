import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { compareSync } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserService } from '../user/user.service';
import { RedisService } from '@/shared/redis.service';
import { CustomException, ErrorCode } from '@/common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';
import { User } from '@/modules/user/user.entity';
import { Role } from '@/modules/role/role.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthCenterService {
  // Access Token过期时间（3小时）
  private readonly ACCESS_TOKEN_EXPIRATION = 3 * 60 * 60;
  // Refresh Token过期时间（3个月）
  private readonly REFRESH_TOKEN_EXPIRATION = 90 * 24 * 60 * 60;

  private readonly logger = new Logger(AuthCenterService.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private redisService: RedisService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

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
   */
  async login(user: any, req: any) {
    // 判断用户是否有enable属性为true的角色
    if (!user.roles?.some((item) => item.enable)) {
      throw new CustomException(ErrorCode.ERR_11003);
    }

    const roleCodes = user.roles?.map((item) => item.code);
    const currentRole = user.roles[0];
    
    // 生成Token对
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
   */
  async generateTokens(payload: any, req?: any) {
    // 生成Access Token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });

    // 生成Refresh Token
    const refreshToken = uuidv4();
    
    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.REFRESH_TOKEN_EXPIRATION);

    // 保存Refresh Token到数据库
    await this.refreshTokenRepository.save({
      token: refreshToken,
      expiresAt,
      userId: payload.userId,
      userAgent: req?.headers['user-agent'],
      ipAddress: req?.ip,
    });

    // 将Access Token保存到Redis，便于快速验证和撤销
    // 使用userId作为key的一部分，方便按用户撤销
    const tokenKey = `auth:access_token:${payload.userId}`;
    await this.redisService.set(
      tokenKey,
      accessToken,
      this.ACCESS_TOKEN_EXPIRATION,
    );

    // 记录用户最后活跃时间
    await this.redisService.set(
      `auth:last_active:${payload.userId}`,
      new Date().toISOString(),
      this.REFRESH_TOKEN_EXPIRATION,
    );

    return {
      accessToken,
      refreshToken,
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

    // 生成新的Token对
    const tokens = await this.generateTokens({
      userId: user.id,
      username: user.username,
      roleCodes,
      currentRoleCode: currentRole.code,
    }, req);

    // 撤销旧的Refresh Token
    refreshTokenEntity.isRevoked = true;
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return tokens;
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
   * 撤销用户的所有Token
   */
  async revokeAllUserTokens(userId: number) {
    // 撤销数据库中的所有Refresh Token
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );

    // 从Redis中删除Access Token
    await this.redisService.del(`auth:access_token:${userId}`);

    return true;
  }

  /**
   * 撤销特定的Refresh Token
   */
  async revokeRefreshToken(refreshTokenString: string) {
    const result = await this.refreshTokenRepository.update(
      { token: refreshTokenString },
      { isRevoked: true }
    );
    
    if (result.affected > 0) {
      const token = await this.refreshTokenRepository.findOne({
        where: { token: refreshTokenString }
      });
      
      if (token) {
        // 同时删除Redis中的Access Token
        await this.redisService.del(`auth:access_token:${token.userId}`);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * 验证Access Token
   */
  async validateAccessToken(token: string) {
    try {
      // 解析Token
      const payload = this.jwtService.verify(token);
      
      // 从Redis获取存储的Token
      const storedToken = await this.redisService.get(`auth:access_token:${payload.userId}`);
      
      // 验证Token是否匹配
      if (token !== storedToken) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取用户的所有活跃会话
   */
  async getUserActiveSessions(userId: number) {
    const currentDate = new Date();
    return this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(currentDate),
      },
      select: ['id', 'userAgent', 'ipAddress', 'createdAt', 'expiresAt'],
    });
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