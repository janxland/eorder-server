import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthCenterService } from '../auth-center.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private authCenterService: AuthCenterService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || configService.get('JWT_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req, payload: any) {
    // 从请求头中提取JWT
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    
    // 验证Token是否有效
    const isValid = await this.authCenterService.validateAccessToken(token);
    
    if (!isValid) {
      throw new UnauthorizedException('Invalid token');
    }
    
    return {
      userId: payload.userId,
      username: payload.username,
      roleCodes: payload.roleCodes || [],
      currentRoleCode: payload.currentRoleCode,
    };
  }
}