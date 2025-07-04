import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCenterService } from './auth-center.service';
import { AuthCenterController } from './auth-center.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          secret: process.env.JWT_SECRET || configService.get('JWT_SECRET'),
        };
      },
    }),
    UserModule,
  ],
  controllers: [AuthCenterController],
  providers: [AuthCenterService],
  exports: [AuthCenterService],
})
export class AuthCenterModule {}