import { Module } from '@nestjs/common';
import { LLMController } from './llm.controller';
import { LLMProxyController } from './llm-proxy.controller';
import { LLMService } from './llm.service';
import { AuthCenterModule } from '../auth-center/auth-center.module';

@Module({
  imports: [AuthCenterModule],
  controllers: [LLMController, LLMProxyController],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}
