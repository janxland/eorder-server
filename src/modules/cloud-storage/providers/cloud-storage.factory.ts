import { Injectable } from '@nestjs/common';
import { StorageProviderType } from '../entities/storage-config.entity';
import { CloudStorageConfig, ICloudStorageProvider } from './cloud-storage.interface';
import { QiniuStorageProvider } from './qiniu-storage.provider';
import { CosStorageProvider } from './cos-storage.provider';
import { OssStorageProvider } from './oss-storage.provider';

/**
 * 云存储工厂类
 */
@Injectable()
export class CloudStorageFactory {
  /**
   * 创建云存储提供商实例
   */
  createProvider(type: StorageProviderType, config: CloudStorageConfig): ICloudStorageProvider {
    switch (type) {
      case StorageProviderType.QINIU:
        return new QiniuStorageProvider(config);
      case StorageProviderType.COS:
        return new CosStorageProvider(config);
      case StorageProviderType.OSS:
        return new OssStorageProvider(config);
      default:
        throw new Error(`不支持的云存储提供商类型: ${type}`);
    }
  }
} 