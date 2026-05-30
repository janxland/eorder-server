import { Module } from '@nestjs/common';
import { LLMController } from './llm.controller';
import { LLMService } from './llm.service';
import { AuthCenterModule } from '../auth-center/auth-center.module';

@Module({
  imports: [AuthCenterModule],
  controllers: [LLMController],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {}