import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AIModelConfig, AIModelType } from '../ai-model/entities/ai-model-config.entity';
import { AppConfig } from '../ai-model/entities/app-config.entity';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    @InjectRepository(AIModelConfig)
    private aiModelConfigRepository: Repository<AIModelConfig>,
    @InjectRepository(AppConfig)
    private appConfigRepository: Repository<AppConfig>,
  ) {}

  /**
   * 获取默认的AI模型配置
   */
  async getDefaultAIModelConfig(): Promise<AIModelConfig | null> {
    try {
      this.logger.debug('Getting default AI model config...');
      const config = await this.aiModelConfigRepository.findOne({
        where: { isDefault: true, isEnabled: true }
      });
      this.logger.debug(`Found default config: ${config ? config.name : 'none'}`);
      return config;
    } catch (error) {
      this.logger.error('Error getting default AI model config:', error);
      throw error;
    }
  }

  /**
   * 根据应用配置获取AI模型配置
   */
  async getAIModelConfigByApp(appConfigId: number): Promise<AIModelConfig | null> {
    try {
      this.logger.debug(`Getting AI model config for app ${appConfigId}...`);
      const appConfig = await this.appConfigRepository.findOne({
        where: { id: appConfigId, isEnabled: true },
        relations: ['aiModelConfig']
      });
      
      if (appConfig?.aiModelConfig) {
        this.logger.debug(`Found AI model config: ${appConfig.aiModelConfig.name}`);
        return appConfig.aiModelConfig;
      }
      
      this.logger.debug('No AI model config found for app, using default');
      return await this.getDefaultAIModelConfig();
    } catch (error) {
      this.logger.error('Error getting AI model config by app:', error);
      throw error;
    }
  }

  /**
   * 流式预测
   */
  async *predictStream(
    inputText: string,
    appConfigId?: number,
    customMessages?: any[],
    temperature: number = 0.7,
    maxTokens: number = 1000,
  ) {
    this.logger.debug(`Starting stream prediction with input: ${inputText.substring(0, 50)}...`);
    
    try {
      const aiModelConfig = appConfigId 
        ? await this.getAIModelConfigByApp(appConfigId)
        : await this.getDefaultAIModelConfig();

      if (!aiModelConfig) {
        this.logger.error('No available AI model configuration found');
        throw new Error('No available AI model configuration found');
      }

      this.logger.debug(`Using AI model: ${aiModelConfig.name} (${aiModelConfig.type})`);

      // 获取应用配置的消息模板
      let messages = customMessages || [];
      if (appConfigId && !customMessages) {
        const appConfig = await this.appConfigRepository.findOne({
          where: { id: appConfigId, isEnabled: true }
        });
        if (appConfig?.messages) {
          messages = [...appConfig.messages];
          this.logger.debug(`Using app config messages: ${appConfig.messages.length} messages`);
        }
      }

      // 添加用户输入
      messages.push({ role: 'user', content: inputText });

      const payload = {
        model: aiModelConfig.model,
        messages,
        stream: true,
        temperature: aiModelConfig.temperature || temperature,
        max_tokens: aiModelConfig.maxTokens || maxTokens,
        top_p: aiModelConfig.topP || 0.9,
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      // 根据不同的AI模型类型设置认证
      switch (aiModelConfig.type) {
        case AIModelType.OPENAI:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        case AIModelType.ANTHROPIC:
          headers['x-api-key'] = aiModelConfig.apiKey;
          break;
        case AIModelType.BAIDU:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        case AIModelType.SILICON_FLOW:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        default:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
      }

      this.logger.debug(`Making request to: ${aiModelConfig.baseUrl}/chat/completions`);

      const response = await axios.post(
        `${aiModelConfig.baseUrl}/chat/completions`, 
        payload, 
        {
          headers,
          timeout: aiModelConfig.timeout || 60000,
          responseType: 'stream',
        }
      );
      
      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data: ')) {
            continue;
          }
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.choices && parsed.choices.length > 0) {
              for (const choice of parsed.choices) {
                const delta = choice.delta || {};
                if (delta.content) {
                  yield { content: delta.content };
                }
              }
            }
          } catch (e) {
            this.logger.error('Failed to parse JSON:', jsonStr);
            continue;
          }
        }
      }
      
      // 更新使用统计
      await this.updateUsageStats(aiModelConfig.id);
      
    } catch (err) {
      this.logger.error('Error in predictStream:', err);
      throw err;
    }
  }

  /**
   * 完整预测（非流式）
   */
  async predictFull(
    inputText: string,
    appConfigId?: number,
    customMessages?: any[],
    temperature: number = 0.7,
    maxTokens: number = 1000,
  ) {
    this.logger.debug(`Starting full prediction with input: ${inputText.substring(0, 50)}...`);
    
    try {
      const aiModelConfig = appConfigId 
        ? await this.getAIModelConfigByApp(appConfigId)
        : await this.getDefaultAIModelConfig();

      if (!aiModelConfig) {
        this.logger.error('No available AI model configuration found');
        throw new Error('No available AI model configuration found');
      }

      this.logger.debug(`Using AI model: ${aiModelConfig.name} (${aiModelConfig.type})`);

      // 获取应用配置的消息模板
      let messages = customMessages || [];
      if (appConfigId && !customMessages) {
        const appConfig = await this.appConfigRepository.findOne({
          where: { id: appConfigId, isEnabled: true }
        });
        if (appConfig?.messages) {
          messages = [...appConfig.messages];
          this.logger.debug(`Using app config messages: ${appConfig.messages.length} messages`);
        }
      }

      // 添加用户输入
      messages.push({ role: 'user', content: inputText });

      const payload = {
        model: aiModelConfig.model,
        messages,
        stream: false,
        temperature: aiModelConfig.temperature || temperature,
        max_tokens: aiModelConfig.maxTokens || maxTokens,
        top_p: aiModelConfig.topP || 0.9,
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      // 根据不同的AI模型类型设置认证
      switch (aiModelConfig.type) {
        case AIModelType.OPENAI:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        case AIModelType.ANTHROPIC:
          headers['x-api-key'] = aiModelConfig.apiKey;
          break;
        case AIModelType.BAIDU:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        case AIModelType.SILICON_FLOW:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
          break;
        default:
          headers['Authorization'] = `Bearer ${aiModelConfig.apiKey}`;
      }

      this.logger.debug(`Making request to: ${aiModelConfig.baseUrl}/chat/completions`);

      const response = await axios.post(
        `${aiModelConfig.baseUrl}/chat/completions`, 
        payload, 
        {
          headers,
          timeout: aiModelConfig.timeout || 60000,
        }
      );

      // 更新使用统计
      await this.updateUsageStats(aiModelConfig.id);

      return response.data;
    } catch (err) {
      this.logger.error('Error in predictFull:', err);
      throw err;
    }
  }

  /**
   * 更新使用统计
   */
  private async updateUsageStats(aiModelConfigId: number) {
    try {
      await this.aiModelConfigRepository.increment(
        { id: aiModelConfigId },
        'usageCount',
        1
      );
      this.logger.debug(`Updated usage stats for AI model config ${aiModelConfigId}`);
    } catch (err) {
      this.logger.error('Failed to update usage stats:', err);
    }
  }

  /**
   * 获取可用的AI模型配置列表
   */
  async getAvailableAIModels() {
    try {
      this.logger.debug('Getting available AI models...');
      const models = await this.aiModelConfigRepository.find({
        where: { isEnabled: true },
        select: ['id', 'name', 'type', 'model', 'isDefault']
      });
      this.logger.debug(`Found ${models.length} available AI models`);
      return models;
    } catch (error) {
      this.logger.error('Error getting available AI models:', error);
      throw error;
    }
  }

  /**
   * 获取应用配置列表
   */
  async getAppConfigs() {
    try {
      this.logger.debug('Getting app configs...');
      const apps = await this.appConfigRepository.find({
        where: { isEnabled: true },
        select: ['id', 'name', 'type', 'description', 'isDefault']
      });
      this.logger.debug(`Found ${apps.length} available app configs`);
      return apps;
    } catch (error) {
      this.logger.error('Error getting app configs:', error);
      throw error;
    }
  }
} 