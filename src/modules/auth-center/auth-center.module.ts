import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthCenterController } from './auth-center.controller';
import { AuthCenterService } from './auth-center.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserModule } from '../user/user.module';
import { SharedModule } from '@/shared/shared.module';
import { User } from '../user/user.entity';
import { Role } from '../role/role.entity';

@Module({
  imports: [
    forwardRef(() => UserModule),
    SharedModule,
    TypeOrmModule.forFeature([RefreshToken, User, Role]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'hard!to-guess_secret',
        signOptions: { expiresIn: '3h' },
      }),
    }),
  ],
  controllers: [AuthCenterController],
  providers: [AuthCenterService],
  exports: [AuthCenterService],
})
export class AuthCenterModule {}