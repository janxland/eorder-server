import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageConfigService } from './storage-config.service';
import { CloudStorageFactory } from './providers/cloud-storage.factory';
import { StorageProviderType } from './entities/storage-config.entity';
import { UploadOptions } from './providers/cloud-storage.interface';

/**
 * 云存储服务
 * 提供统一的文件操作接口，自动根据配置选择对应的云存储提供商
 */
@Injectable()
export class CloudStorageService {
  constructor(
    private readonly storageConfigService: StorageConfigService,
    private readonly cloudStorageFactory: CloudStorageFactory,
  ) {}

  /**
   * 获取上传凭证
   */
  async getUploadToken(
    providerType: StorageProviderType,
    key?: string,
    expires?: number,
    configId?: number,
  ): Promise<string> {
    const provider = configId 
      ? await this.getStorageProviderById(configId)
      : await this.getStorageProvider(providerType);
    return provider.getUploadToken(key, expires);
  }

  /**
   * 获取临时上传URL
   */
  async getUploadUrl(
    providerType: StorageProviderType,
    key: string,
    expires?: number,
    configId?: number,
  ): Promise<string> {
    const provider = configId 
      ? await this.getStorageProviderById(configId)
      : await this.getStorageProvider(providerType);
    return provider.getUploadUrl(key, expires);
  }

  /**
   * 获取文件访问URL
   */
  async getFileUrl(
    providerType: StorageProviderType,
    key: string,
    expires?: number,
    configId?: number,
  ): Promise<string> {
    const provider = configId 
      ? await this.getStorageProviderById(configId)
      : await this.getStorageProvider(providerType);
    return provider.getFileUrl(key, expires);
  }

  /**
   * 上传文件
   */
  async uploadFile(
    providerType: StorageProviderType,
    fileBuffer: Buffer,
    key: string,
    options?: UploadOptions,
    configId?: number,
  ): Promise<string> {
    const provider = configId 
      ? await this.getStorageProviderById(configId)
      : await this.getStorageProvider(providerType);
    return provider.uploadFile(fileBuffer, key, options);
  }

  /**
   * 删除文件
   */
  async deleteFile(
    providerType: StorageProviderType,
    key: string,
    configId?: number,
  ): Promise<boolean> {
    const provider = configId 
      ? await this.getStorageProviderById(configId)
      : await this.getStorageProvider(providerType);
    return provider.deleteFile(key);
  }

  /**
   * 获取存储提供商实例（根据类型使用默认配置）
   */
  private async getStorageProvider(providerType: StorageProviderType) {
    try {
      const config = await this.storageConfigService.findDefaultByType(providerType);
      return this.cloudStorageFactory.createProvider(providerType, {
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
        region: config.region,
        endpoint: config.endpoint,
        domain: config.domain,
        extraConfig: config.extraConfig,
      });
    } catch (error) {
      throw new NotFoundException(`未找到可用的${providerType}存储配置`);
    }
  }

  /**
   * 根据配置ID获取存储提供商实例
   */
  private async getStorageProviderById(configId: number) {
    try {
      const config = await this.storageConfigService.findOne(configId);
      
      if (!config.isEnabled) {
        throw new NotFoundException(`ID为${configId}的云存储配置已禁用`);
      }
      
      return this.cloudStorageFactory.createProvider(config.provider, {
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
        region: config.region,
        endpoint: config.endpoint,
        domain: config.domain,
        extraConfig: config.extraConfig,
      });
    } catch (error) {
      throw new NotFoundException(`未找到可用的云存储配置，ID: ${configId}`);
    }
  }
} 