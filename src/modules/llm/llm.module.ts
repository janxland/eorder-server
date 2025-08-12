import { Module } from '@nestjs/common';
import { LLMController } from './llm.controller';
import { LLMService } from './llm.service';
import { Tools } from './tools';

@Module({
  controllers: [LLMController],
  providers: [LLMService, Tools],
  exports: [LLMService],
})
export class LLMModule {}