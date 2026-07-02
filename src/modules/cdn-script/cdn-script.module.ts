/**
 * CDN 模块
 * website: https://www.roginx.ink
 */

import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CdnScriptController } from './cdn-script.controller';
import { CdnScriptService } from './cdn-script.service';
import { CdnConfigController } from './cdn-config.controller';
import { CdnConfigService } from './cdn-config.service';
import { CdnConfig, CdnConfigSchema } from './cdn-config.entity';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    forwardRef(() => AuthCenterModule),
    MongooseModule.forFeature([{ name: CdnConfig.name, schema: CdnConfigSchema }]),
  ],
  controllers: [CdnScriptController, CdnConfigController],
  providers: [CdnScriptService, CdnConfigService],
  exports: [CdnScriptService, CdnConfigService],
})
export class CdnScriptModule {}
