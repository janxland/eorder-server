import { Module } from '@nestjs/common';
import { LLMController } from './llm.controller';
import { LLMService } from './llm.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModelConfig } from '../ai-model/entities/ai-model-config.entity';
import { AppConfig } from '../ai-model/entities/app-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AIModelConfig, AppConfig]),
  ],
  controllers: [LLMController],
  providers: [LLMService],
  exports: [LLMService],
})
export class LLMModule {} 