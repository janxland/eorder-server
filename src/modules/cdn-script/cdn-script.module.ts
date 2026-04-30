/**
 * website: https://www.roginx.ink
 */

import { Module } from '@nestjs/common';
import { CdnScriptController } from './cdn-script.controller';
import { CdnScriptService } from './cdn-script.service';

@Module({
  controllers: [CdnScriptController],
  providers: [CdnScriptService],
  exports: [CdnScriptService],
})
export class CdnScriptModule {}
