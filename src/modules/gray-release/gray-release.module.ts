/**
 * 灰度发布模块
 * website: https://www.roginx.ink
 */

import { forwardRef, Module } from '@nestjs/common';
import { GrayReleaseController } from './gray-release.controller';
import { GrayReleaseService } from './gray-release.service';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    forwardRef(() => AuthCenterModule)
  ],
  controllers: [GrayReleaseController],
  providers: [GrayReleaseService],
  exports: [GrayReleaseService], // 导出服务，供其他模块使用
})
export class GrayReleaseModule {}

