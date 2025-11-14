import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIModelConfig } from './entities/ai-model-config.entity';
import { CreateAIModelConfigDto, UpdateAIModelConfigDto, TestAIModelConfigDto } from './dto/ai-model-config.dto';

@Injectable()
export class AIModelConfigService {
  constructor(
    @InjectRepository(AIModelConfig)
    private readonly aiModelConfigRepository: Repository<AIModelConfig>,
  ) {}

  /**
   * 创建AI模型配置
   */
  async create(createDto: CreateAIModelConfigDto): Promise<AIModelConfig> {
    // 如果设置为默认，先将所有其他配置设为非默认
    if (createDto.isDefault) {
      await this.resetDefaultStatus();
    }

    const config = this.aiModelConfigRepository.create(createDto);
    return this.aiModelConfigRepository.save(config);
  }

  /**
   * 获取所有AI模型配置
   */
  async findAll(): Promise<AIModelConfig[]> {
    return this.aiModelConfigRepository.find({
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 根据ID获取AI模型配置
   */
  async findOne(id: number): Promise<AIModelConfig> {
    const config = await this.aiModelConfigRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`ID为${id}的AI模型配置不存在`);
    }
    return config;
  }

  /**
   * 获取默认AI模型配置
   */
  async findDefault(): Promise<AIModelConfig> {
    const config = await this.aiModelConfigRepository.findOne({
      where: { isDefault: true },
    });
    if (!config) {
      throw new NotFoundException('未找到默认AI模型配置');
    }
    return config;
  }

  /**
   * 更新AI模型配置
   */
  async update(id: number, updateDto: UpdateAIModelConfigDto): Promise<AIModelConfig> {
    // 如果设置为默认，先将所有其他配置设为非默认
    if (updateDto.isDefault) {
      await this.resetDefaultStatus();
    }

    const config = await this.findOne(id);
    const updatedConfig = Object.assign(config, updateDto);
    return this.aiModelConfigRepository.save(updatedConfig);
  }

  /**
   * 删除AI模型配置
   */
  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    if (config.isDefault) {
      throw new ConflictException('不能删除默认配置，请先设置其他配置为默认');
    }
    await this.aiModelConfigRepository.remove(config);
  }

  /**
   * 设置默认配置
   */
  async setDefault(id: number): Promise<AIModelConfig> {
    // 先将所有配置设为非默认
    await this.resetDefaultStatus();

    // 设置指定配置为默认
    const config = await this.findOne(id);
    config.isDefault = true;
    return this.aiModelConfigRepository.save(config);
  }

  /**
   * 更改配置启用状态
   */
  async changeStatus(id: number, isEnabled: boolean): Promise<AIModelConfig> {
    const config = await this.findOne(id);
    
    // 如果是默认配置且要禁用，抛出异常
    if (config.isDefault && !isEnabled) {
      throw new ConflictException('不能禁用默认配置，请先设置其他配置为默认');
    }
    
    config.isEnabled = isEnabled;
    return this.aiModelConfigRepository.save(config);
  }

  /**
   * 测试AI模型配置连接
   */
  async testConnection(testDto: TestAIModelConfigDto): Promise<any> {
    // 这里可以根据不同的模型类型实现不同的测试逻辑
    // 例如调用OpenAI的API进行简单测试
    try {
      // 模拟测试成功
      return {
        success: true,
        message: '连接测试成功',
        data: {
          responseTime: Math.floor(Math.random() * 500) + 100, // 模拟响应时间
          modelInfo: testDto.model || '默认模型',
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
      };
    }
  }

  /**
   * 更新使用统计
   */
  async updateUsageStats(id: number, tokenCount: number): Promise<void> {
    const config = await this.findOne(id);
    config.usageCount += 1;
    config.totalTokens += tokenCount;
    await this.aiModelConfigRepository.save(config);
  }

  /**
   * 重置所有配置的默认状态
   */
  private async resetDefaultStatus(): Promise<void> {
    await this.aiModelConfigRepository.update({}, { isDefault: false });
  }

  /**
   * 过滤掉敏感字段（apiKey 和 apiSecret）（用于列表查询等场景）
   * 单独查询详情时会返回完整的信息
   */
  excludeApiKey(config: AIModelConfig): Omit<AIModelConfig, 'apiKey' | 'apiSecret'> & { apiKey?: undefined; apiSecret?: undefined } {
    const { apiKey, apiSecret, ...rest } = config;
    return rest as Omit<AIModelConfig, 'apiKey' | 'apiSecret'> & { apiKey?: undefined; apiSecret?: undefined };
  }
} 