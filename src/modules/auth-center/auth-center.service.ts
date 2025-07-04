import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthCenterService {
  // Access Token过期时间（30分钟）
  private readonly ACCESS_TOKEN_EXPIRATION = 30 * 60;
  // Refresh Token过期时间（28天）
  private readonly REFRESH_TOKEN_EXPIRATION = 7 * 24 * 60 * 60 * 4;

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private redisService: RedisService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * 验证用户凭据
   */
  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username);
    if (user && compareSync(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
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
    await this.redisService.set(
      `auth:access_token:${payload.userId}`,
      accessToken,
      this.ACCESS_TOKEN_EXPIRATION,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    };
  }

  /**
   * 使用Refresh Token刷新Access Token
   */
  async refreshAccessToken(refreshTokenString: string) {
    // 查找Refresh Token
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString, isRevoked: false },
      relations: ['user'],
    });

    // 验证Refresh Token
    if (!refreshTokenEntity) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 检查是否过期
    if (new Date() > refreshTokenEntity.expiresAt) {
      // 标记为已撤销
      refreshTokenEntity.isRevoked = true;
      await this.refreshTokenRepository.save(refreshTokenEntity);
      throw new UnauthorizedException('Refresh token expired');
    }

    // 获取用户信息
    const user = await this.userService.findUserProfile(refreshTokenEntity.userId);
    if (!user || !user.enable) {
      throw new UnauthorizedException('User is disabled');
    }

    const roleCodes = user.roles?.map((item) => item.code);
    const currentRole = user.roles.find(role => role.enable) || user.roles[0];

    // 生成新的Access Token
    const accessToken = this.jwtService.sign({
      userId: user.id,
      username: user.username,
      roleCodes,
      currentRoleCode: currentRole.code,
    }, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });

    // 更新Redis中的Access Token
    await this.redisService.set(
      `auth:access_token:${user.id}`,
      accessToken,
      this.ACCESS_TOKEN_EXPIRATION,
    );

    return {
      accessToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    };
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
}