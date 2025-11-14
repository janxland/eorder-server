import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageConfig } from './entities/storage-config.entity';
import { CreateStorageConfigDto, TestStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { CloudStorageFactory } from './providers/cloud-storage.factory';

@Injectable()
export class StorageConfigService {
  private readonly logger = new Logger(StorageConfigService.name);

  constructor(
    @InjectRepository(StorageConfig)
    private readonly storageConfigRepository: Repository<StorageConfig>,
    private readonly cloudStorageFactory: CloudStorageFactory,
  ) {}

  /**
   * 获取所有存储配置
   * @param userId 用户ID（可选）
   * @returns 存储配置列表
   */
  async findAll(userId?: number): Promise<StorageConfig[]> {
    this.logger.debug(`获取所有存储配置: userId=${userId}`);
    return this.storageConfigRepository.find();
  }

  /**
   * 获取启用的存储配置
   * @param userId 用户ID（可选）
   * @returns 启用的存储配置列表
   */
  async findEnabled(userId?: number): Promise<StorageConfig[]> {
    this.logger.debug(`获取启用的存储配置: userId=${userId}`);
    return this.storageConfigRepository.find({
      where: { isEnabled: true },
    });
  }

  /**
   * 获取默认存储配置
   * @param userId 用户ID（可选）
   * @returns 默认存储配置
   */
  async findDefault(userId?: number): Promise<StorageConfig> {
    this.logger.debug(`获取默认存储配置: userId=${userId}`);
    const config = await this.storageConfigRepository.findOne({
      where: { isDefault: true, isEnabled: true },
    });

    if (!config) {
      // 如果没有默认配置，则获取第一个启用的配置
      const firstEnabled = await this.storageConfigRepository.findOne({
        where: { isEnabled: true },
      });

      if (firstEnabled) {
        return firstEnabled;
      }

      throw new NotFoundException('未找到可用的存储配置');
    }

    return config;
  }

  /**
   * 根据ID获取存储配置
   * @param id 配置ID
   * @param userId 用户ID（可选）
   * @returns 存储配置
   */
  async findById(id: number, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`根据ID获取存储配置: id=${id}, userId=${userId}`);
    const config = await this.storageConfigRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`未找到ID为${id}的存储配置`);
    }

    return config;
  }

  /**
   * 创建存储配置
   * @param createDto 创建DTO
   * @param userId 用户ID（可选）
   * @returns 创建的存储配置
   */
  async create(createDto: CreateStorageConfigDto, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`创建存储配置: userId=${userId}`);
    // 如果设置为默认，则将其他配置的默认标志设为false
    if (createDto.isDefault) {
      await this.resetDefaultFlag();
    }

    const config = this.storageConfigRepository.create(createDto);
    return this.storageConfigRepository.save(config);
  }

  /**
   * 更新存储配置
   * @param id 配置ID
   * @param updateDto 更新DTO
   * @param userId 用户ID（可选）
   * @returns 更新后的存储配置
   */
  async update(id: number, updateDto: UpdateStorageConfigDto, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`更新存储配置: id=${id}, userId=${userId}`);
    const config = await this.findById(id);

    // 如果设置为默认，则将其他配置的默认标志设为false
    if (updateDto.isDefault && !config.isDefault) {
      await this.resetDefaultFlag();
    }

    // 更新配置
    Object.assign(config, updateDto);
    return this.storageConfigRepository.save(config);
  }

  /**
   * 删除存储配置
   * @param id 配置ID
   * @param userId 用户ID（可选）
   * @returns 是否成功
   */
  async remove(id: number, userId?: number): Promise<boolean> {
    this.logger.debug(`删除存储配置: id=${id}, userId=${userId}`);
    const config = await this.findById(id);
    
    // 如果是默认配置，不允许删除
    if (config.isDefault) {
      throw new Error('不能删除默认配置，请先设置其他配置为默认');
    }

    const result = await this.storageConfigRepository.delete(id);
    return result.affected > 0;
  }

  /**
   * 设置默认配置
   * @param id 配置ID
   * @param userId 用户ID（可选）
   * @returns 设置为默认的配置
   */
  async setDefault(id: number, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`设置默认配置: id=${id}, userId=${userId}`);
    const config = await this.findById(id);
    
    // 如果已经是默认配置，直接返回
    if (config.isDefault) {
      return config;
    }

    // 重置所有配置的默认标志
    await this.resetDefaultFlag();

    // 设置新的默认配置
    config.isDefault = true;
    return this.storageConfigRepository.save(config);
  }

  /**
   * 更改配置启用状态
   * @param id 配置ID
   * @param isEnabled 是否启用
   * @param userId 用户ID（可选）
   * @returns 更新后的配置
   */
  async changeStatus(id: number, isEnabled: boolean, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`更改配置启用状态: id=${id}, isEnabled=${isEnabled}, userId=${userId}`);
    const config = await this.findById(id);
    
    // 如果是默认配置且要禁用，不允许操作
    if (config.isDefault && !isEnabled) {
      throw new Error('不能禁用默认配置，请先设置其他配置为默认');
    }

    config.isEnabled = isEnabled;
    return this.storageConfigRepository.save(config);
  }

  /**
   * 测试存储配置连接
   * @param testDto 测试DTO
   * @param userId 用户ID（可选）
   * @returns 测试结果
   */
  async testConnection(testDto: TestStorageConfigDto, userId?: number): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`测试存储配置连接: userId=${userId}`);
    try {
      // 创建临时配置
      const tempConfig = this.storageConfigRepository.create(testDto);
      
      // 创建存储提供商实例
      const provider = this.cloudStorageFactory.create(tempConfig);
      
      // 测试连接
      const success = await provider.testConnection();
      
      return {
        success,
        message: success ? '连接成功' : '连接失败',
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
      };
    }
  }

  /**
   * 重置所有配置的默认标志
   */
  private async resetDefaultFlag(): Promise<void> {
    await this.storageConfigRepository.update({ isDefault: true }, { isDefault: false });
  }

  /**
   * 根据名称获取存储配置
   * @param name 配置名称
   * @param userId 用户ID（可选）
   * @returns 存储配置
   */
  async findByName(name: string, userId?: number): Promise<StorageConfig> {
    this.logger.debug(`根据名称获取存储配置: name=${name}, userId=${userId}`);
    const config = await this.storageConfigRepository.findOne({
      where: { name, isEnabled: true },
    });

    if (!config) {
      this.logger.debug(`未找到名称为"${name}"的存储配置`);
      return null;
    }

    return config;
  }

  /**
   * 过滤掉敏感字段（用于列表查询等场景）
   * 单独查询详情时会返回完整的信息
   */
  excludeSensitiveFields(config: StorageConfig): Omit<StorageConfig, 'accessKey' | 'secretKey'> & { accessKey?: undefined; secretKey?: undefined } {
    const { accessKey, secretKey, ...rest } = config;
    return rest as Omit<StorageConfig, 'accessKey' | 'secretKey'> & { accessKey?: undefined; secretKey?: undefined };
  }
} 