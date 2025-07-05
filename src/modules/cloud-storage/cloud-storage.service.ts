import { Injectable, Logger } from '@nestjs/common';
import { StorageConfigService } from './storage-config.service';
import { CloudStorageFactory } from './providers/cloud-storage.factory';
import { UploadDto } from './dto/storage-config.dto';
import { StorageConfig } from './entities/storage-config.entity';

/**
 * 云存储服务
 * 提供统一的文件操作接口，自动根据配置选择对应的云存储提供商
 */
@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  constructor(
    private readonly storageConfigService: StorageConfigService,
    private readonly cloudStorageFactory: CloudStorageFactory,
  ) {}

  /**
   * 获取上传凭证
   * @param uploadDto 上传DTO
   * @param userId 用户ID（可选）
   * @returns 上传凭证
   */
  async getUploadToken(uploadDto: UploadDto, userId?: number): Promise<any> {
    this.logger.debug(`获取上传凭证: userId=${userId}, key=${uploadDto.key}`);
    
    const { key, configId } = uploadDto;
    
    // 获取存储配置
    const config = configId 
      ? await this.storageConfigService.findById(configId)
      : await this.storageConfigService.findDefault();
    
    // 创建存储提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 获取上传凭证
    return provider.getUploadToken(key);
  }

  /**
   * 获取上传URL
   * @param uploadDto 上传DTO
   * @param userId 用户ID（可选）
   * @returns 上传URL
   */
  async getUploadUrl(uploadDto: UploadDto, userId?: number): Promise<string> {
    this.logger.debug(`获取上传URL: userId=${userId}, key=${uploadDto.key}`);
    
    const { key, configId } = uploadDto;
    
    // 获取存储配置
    const config = configId 
      ? await this.storageConfigService.findById(configId)
      : await this.storageConfigService.findDefault();
    
    // 创建存储提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 获取上传URL
    return provider.getUploadUrl(key);
  }

  /**
   * 获取文件URL
   * @param key 文件路径
   * @param configId 配置ID
   * @param userId 用户ID（可选）
   * @returns 文件URL
   */
  async getFileUrl(key: string, configId?: number, userId?: number): Promise<string> {
    this.logger.debug(`获取文件URL: userId=${userId}, key=${key}`);
    
    // 获取存储配置
    const config = configId 
      ? await this.storageConfigService.findById(configId)
      : await this.storageConfigService.findDefault();
    
    // 创建存储提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 获取文件URL
    return provider.getFileUrl(key);
  }

  /**
   * 删除文件
   * @param key 文件路径
   * @param configId 配置ID
   * @param userId 用户ID（可选）
   * @returns 是否成功
   */
  async deleteFile(key: string, configId?: number, userId?: number): Promise<boolean> {
    this.logger.debug(`删除文件: userId=${userId}, key=${key}`);
    
    // 获取存储配置
    const config = configId 
      ? await this.storageConfigService.findById(configId)
      : await this.storageConfigService.findDefault();
    
    // 创建存储提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 删除文件
    return provider.deleteFile(key);
  }

  /**
   * 测试连接
   * @param configId 配置ID
   * @returns 是否成功
   */
  async testConnection(configId: number): Promise<boolean> {
    // 获取存储配置
    const config = await this.storageConfigService.findById(configId);
    
    // 创建存储提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 测试连接
    return provider.testConnection();
  }

  /**
   * 生成临时密钥
   * @param config 存储配置
   * @param prefix 文件路径前缀
   * @param expires 过期时间（秒）
   */
  async generateTempCredentials(config: StorageConfig, prefix?: string, expires = 1800): Promise<any> {
    this.logger.debug(`生成临时密钥: configId=${config.id}, prefix=${prefix}`);
    
    // 根据存储类型创建对应的提供商实例
    const provider = this.cloudStorageFactory.create(config);
    
    // 检查provider是否实现了generateTempCredentials方法
    if (typeof (provider as any).generateTempCredentials !== 'function') {
      throw new Error(`存储提供商 ${config.type} 不支持生成临时密钥`);
    }
    
    // 生成临时密钥
    return (provider as any).generateTempCredentials(prefix, expires);
  }
} 