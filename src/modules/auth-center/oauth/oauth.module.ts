import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OauthClient } from './oauth-client.entity';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { AuthCenterModule } from '../auth-center.module';
import { SharedModule } from '@/shared/shared.module';

/**
 * OAuth2.0 授权码模块
 * 复用 AuthCenter 账号体系与 token 机制，低耦合挂载
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OauthClient]),
    forwardRef(() => AuthCenterModule),
    SharedModule,
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
