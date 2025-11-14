import { Module } from '@nestjs/common';
import { LLMController } from './llm.controller';
import { LLMService } from './llm.service';
import { Tools } from './tools';
import { AuthCenterModule } from '../auth-center/auth-center.module';

@Module({
  imports: [AuthCenterModule],
  controllers: [LLMController],
  providers: [LLMService, Tools],
  exports: [LLMService],
})
export class LLMModule {}