import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';
import { AIModelConfig } from './entities/ai-model-config.entity';
import { CreateAppConfigDto, UpdateAppConfigDto, SearchAppConfigDto } from './dto/app-config.dto';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfig)
    private readonly appConfigRepository: Repository<AppConfig>,
    @InjectRepository(AIModelConfig)
    private readonly aiModelConfigRepository: Repository<AIModelConfig>,
  ) {}

  /**
   * 创建应用配置
   */
  async create(createDto: CreateAppConfigDto): Promise<AppConfig> {
    // 如果设置为默认，先将所有其他配置设为非默认
    if (createDto.isDefault) {
      await this.resetDefaultStatus();
    }

    const config = this.appConfigRepository.create(createDto);
    return this.appConfigRepository.save(config);
  }

  /**
   * 获取所有应用配置
   */
  async findAll(search?: SearchAppConfigDto): Promise<AppConfig[]> {
    const whereCondition: any = {};
    
    if (search) {
      if (search.name) {
        whereCondition.name = Like(`%${search.name}%`);
      }
      
      if (search.type) {
        whereCondition.type = search.type;
      }
      
      if (search.isEnabled !== undefined) {
        whereCondition.isEnabled = search.isEnabled;
      }
      
      if (search.aiModelConfigId !== undefined) {
        whereCondition.aiModelConfigId = search.aiModelConfigId;
      }
    }
    
    const configs = await this.appConfigRepository.find({
      where: Object.keys(whereCondition).length > 0 ? whereCondition : undefined,
      relations: ['aiModelConfig'],
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
    
    // 如果配置没有绑定AI模型配置，则获取默认的AI模型配置
    const defaultAIModelConfig = await this.getDefaultAIModelConfig();
    
    // 为没有绑定AI模型配置的应用配置设置默认AI模型配置
    return configs.map(config => {
      if (!config.aiModelConfig) {
        config.aiModelConfig = defaultAIModelConfig;
      }
      return config;
    });
  }

  /**
   * 根据ID获取应用配置
   */
  async findOne(id: number): Promise<AppConfig> {
    const config = await this.appConfigRepository.findOne({ 
      where: { id },
      relations: ['aiModelConfig']
    });
    
    if (!config) {
      throw new NotFoundException(`ID为${id}的应用配置不存在`);
    }
    
    // 如果配置没有绑定AI模型配置，则获取默认的AI模型配置
    if (!config.aiModelConfig) {
      config.aiModelConfig = await this.getDefaultAIModelConfig();
    }
    
    return config;
  }

  /**
   * 根据名称查找应用配置
   */
  async findByName(name: string): Promise<AppConfig> {
    const config = await this.appConfigRepository.findOne({
      where: { name: Like(`%${name}%`) },
      relations: ['aiModelConfig']
    });
    
    if (!config) {
      throw new NotFoundException(`名称包含"${name}"的应用配置不存在`);
    }
    
    // 如果配置没有绑定AI模型配置，则获取默认的AI模型配置
    if (!config.aiModelConfig) {
      config.aiModelConfig = await this.getDefaultAIModelConfig();
    }
    
    return config;
  }

  /**
   * 获取默认应用配置
   */
  async findDefault(): Promise<AppConfig> {
    const config = await this.appConfigRepository.findOne({
      where: { isDefault: true },
      relations: ['aiModelConfig']
    });
    
    if (!config) {
      throw new NotFoundException('未找到默认应用配置');
    }
    
    // 如果配置没有绑定AI模型配置，则获取默认的AI模型配置
    if (!config.aiModelConfig) {
      config.aiModelConfig = await this.getDefaultAIModelConfig();
    }
    
    return config;
  }

  /**
   * 更新应用配置
   */
  async update(id: number, updateDto: UpdateAppConfigDto): Promise<AppConfig> {
    // 如果设置为默认，先将所有其他配置设为非默认
    if (updateDto.isDefault) {
      await this.resetDefaultStatus();
    }

    const config = await this.findOne(id);
    const updatedConfig = Object.assign(config, updateDto);
    return this.appConfigRepository.save(updatedConfig);
  }

  /**
   * 删除应用配置
   */
  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    if (config.isDefault) {
      throw new ConflictException('不能删除默认配置，请先设置其他配置为默认');
    }
    await this.appConfigRepository.remove(config);
  }

  /**
   * 设置默认配置
   */
  async setDefault(id: number): Promise<AppConfig> {
    // 先将所有配置设为非默认
    await this.resetDefaultStatus();

    // 设置指定配置为默认
    const config = await this.findOne(id);
    config.isDefault = true;
    return this.appConfigRepository.save(config);
  }

  /**
   * 更改配置启用状态
   */
  async changeStatus(id: number, isEnabled: boolean): Promise<AppConfig> {
    const config = await this.findOne(id);
    
    // 如果是默认配置且要禁用，抛出异常
    if (config.isDefault && !isEnabled) {
      throw new ConflictException('不能禁用默认配置，请先设置其他配置为默认');
    }
    
    config.isEnabled = isEnabled;
    return this.appConfigRepository.save(config);
  }

  /**
   * 重置所有配置的默认状态
   */
  private async resetDefaultStatus(): Promise<void> {
    await this.appConfigRepository.update({}, { isDefault: false });
  }
  
  /**
   * 获取默认的AI模型配置
   */
  private async getDefaultAIModelConfig(): Promise<AIModelConfig> {
    const defaultConfig = await this.aiModelConfigRepository.findOne({
      where: { isDefault: true }
    });
    
    if (!defaultConfig) {
      throw new NotFoundException('未找到默认AI模型配置');
    }
    
    return defaultConfig;
  }

  /**
   * 过滤掉关联的AI模型配置中的敏感字段（用于列表查询等场景）
   * 单独查询详情时会返回完整的信息
   */
  excludeSensitiveFields(config: AppConfig): AppConfig {
    if (config.aiModelConfig) {
      const { apiKey, apiSecret, ...restAIModelConfig } = config.aiModelConfig;
      return {
        ...config,
        aiModelConfig: {
          ...restAIModelConfig,
          apiKey: undefined,
          apiSecret: undefined,
        } as AIModelConfig,
      };
    }
    return config;
  }
} 