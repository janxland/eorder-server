import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModelConfig } from './entities/ai-model-config.entity';
import { AppConfig } from './entities/app-config.entity';
import { AIModelConfigController } from './ai-model-config.controller';
import { AIModelConfigService } from './ai-model-config.service';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { ModuleRef } from '@nestjs/core';
import { AIModelType } from './entities/ai-model-config.entity';
import { AppType } from './entities/app-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AIModelConfig, AppConfig]),
  ],
  controllers: [AIModelConfigController, AppConfigController],
  providers: [AIModelConfigService, AppConfigService],
  exports: [AIModelConfigService, AppConfigService],
})
export class AIModelModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private appConfigService: AppConfigService
  ) {}

  async onModuleInit() {
    // 初始化时创建默认的硅基流动配置
    const aiModelConfigService = this.moduleRef.get(AIModelConfigService);
    
    try {
      // 检查是否已存在硅基流动配置
      const configs = await aiModelConfigService.findAll();
      const siliconFlowConfig = configs.find(config => config.type === AIModelType.SILICON_FLOW);
      
      if (!siliconFlowConfig) {
        console.log('正在创建默认硅基流动配置...');
        
        // 创建默认的硅基流动配置
        await aiModelConfigService.create({
          name: '硅基流动 API',
          type: AIModelType.SILICON_FLOW,
          apiKey: 'sf_demo_key_123456',
          baseUrl: 'https://api.siliconflow.ai/v1',
          model: 'sf-gemma-7b',
          maxTokens: 4096,
          temperature: 0.7,
          topP: 0.9,
          timeout: 60000,
          isDefault: configs.length === 0, // 如果没有其他配置，则设为默认
          isEnabled: true,
          description: '硅基流动是一个高性能的国产大模型服务，支持多种开源模型和自定义模型。'
        });
        
        console.log('硅基流动配置创建成功');
      }
      
      // 创建默认的应用配置
      try {
        const appConfigs = await this.appConfigService.findAll();
        
        if (appConfigs.length === 0) {
          console.log('正在创建默认应用配置...');
          
          // 创建头歌考试的默认配置
          await this.appConfigService.create({
            name: '头歌考试',
            type: AppType.BROWSER_EXTENSION,
            selector: '[class^="questionTypeTitle___"]',
            isDefault: true,
            isEnabled: true,
            messages: [
              { role: 'system', content: '#你所有的回答都是JSON格式【你所有的回答都是JSON格式】' },
              { role: 'system', content: '不要多余解释！单选题多选题和判断题只要答案的选项即可（单选题answer字段是只有一个元素的数组，多选题answer字段是数组，判断题数组元素是正确或者是错误）,最终输出格式为:{ "answer": ["A","*"]  }' },
              { role: 'system', content: '不要多余解释！填空题一个问题可能有多个空要确保，一个填空标志为▁▁▁▁▁，或者识别填空项1,填空项2,填空项3...作为最终数组的length，不要多出数组！答案是数组{ "answer": ["填空答案一","二"]  }' }
            ],
            extraConfig: {
              temperature: 0.3,
              top_p: 0.9,
              model: 'Qwen/Qwen2.5-7B-Instruct'
            },
            description: '头歌考试自动答题配置'
          });
          
          console.log('默认应用配置创建成功');
        }
      } catch (error) {
        console.error('创建默认应用配置失败:', error);
      }
    } catch (error) {
      console.error('创建硅基流动配置失败:', error);
    }
  }
} 