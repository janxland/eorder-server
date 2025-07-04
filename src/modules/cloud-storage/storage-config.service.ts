import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageConfig, StorageProviderType } from './entities/storage-config.entity';
import { CreateStorageConfigDto, UpdateStorageConfigDto, TestStorageConfigDto } from './dto/storage-config.dto';
import { CloudStorageFactory } from './providers/cloud-storage.factory';

@Injectable()
export class StorageConfigService {
  constructor(
    @InjectRepository(StorageConfig)
    private readonly storageConfigRepository: Repository<StorageConfig>,
    private readonly cloudStorageFactory: CloudStorageFactory,
  ) {}

  /**
   * 创建云存储配置
   */
  async create(createDto: CreateStorageConfigDto): Promise<StorageConfig> {
    // 如果设置为默认，则将其他同类型配置设为非默认
    if (createDto.isDefault) {
      await this.resetDefaultConfig(createDto.provider);
    }
    
    const config = this.storageConfigRepository.create(createDto);
    return this.storageConfigRepository.save(config);
  }

  /**
   * 获取所有云存储配置
   */
  async findAll(): Promise<StorageConfig[]> {
    return this.storageConfigRepository.find({
      order: {
        provider: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 根据ID获取云存储配置
   */
  async findOne(id: number): Promise<StorageConfig> {
    const config = await this.storageConfigRepository.findOne({
      where: { id },
    });
    
    if (!config) {
      throw new NotFoundException(`ID为${id}的云存储配置不存在`);
    }
    
    return config;
  }

  /**
   * 获取指定类型的默认配置
   */
  async findDefaultByType(provider: StorageProviderType): Promise<StorageConfig> {
    const config = await this.storageConfigRepository.findOne({
      where: { 
        provider,
        isDefault: true,
        isEnabled: true,
      },
    });
    
    if (!config) {
      throw new NotFoundException(`未找到${provider}类型的默认配置`);
    }
    
    return config;
  }

  /**
   * 获取指定类型的所有可用配置
   */
  async findAllByType(provider: StorageProviderType): Promise<StorageConfig[]> {
    return this.storageConfigRepository.find({
      where: {
        provider,
        isEnabled: true,
      },
      order: {
        isDefault: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 更新云存储配置
   */
  async update(id: number, updateDto: UpdateStorageConfigDto): Promise<StorageConfig> {
    const config = await this.findOne(id);
    
    // 如果设置为默认，则将其他同类型配置设为非默认
    if (updateDto.isDefault) {
      await this.resetDefaultConfig(config.provider);
    }
    
    Object.assign(config, updateDto);
    return this.storageConfigRepository.save(config);
  }

  /**
   * 删除云存储配置
   */
  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    await this.storageConfigRepository.remove(config);
  }

  /**
   * 测试云存储配置连接
   */
  async testConnection(testDto: TestStorageConfigDto): Promise<{ success: boolean; message: string }> {
    try {
      const provider = this.cloudStorageFactory.createProvider(testDto.provider, {
        accessKeyId: testDto.accessKeyId,
        accessKeySecret: testDto.accessKeySecret,
        bucket: testDto.bucket,
        region: testDto.region,
        endpoint: testDto.endpoint,
        domain: testDto.domain,
        extraConfig: testDto.extraConfig,
      });
      
      const result = await provider.testConnection();
      return {
        success: true,
        message: '连接测试成功',
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
      };
    }
  }

  /**
   * 重置指定类型的默认配置
   */
  private async resetDefaultConfig(provider: StorageProviderType): Promise<void> {
    await this.storageConfigRepository.update(
      { provider, isDefault: true },
      { isDefault: false }
    );
  }
} 