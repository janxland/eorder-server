/**
 * website: https://www.roginx.ink
 */

import { forwardRef, Module } from '@nestjs/common';
import { CdnScriptController } from './cdn-script.controller';
import { CdnScriptService } from './cdn-script.service';
import { CdnScriptLicenseService } from './cdn-script-license.service';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [forwardRef(() => AuthCenterModule)],
  controllers: [CdnScriptController],
  providers: [CdnScriptService, CdnScriptLicenseService],
  exports: [CdnScriptService, CdnScriptLicenseService],
})
export class CdnScriptModule {}
