import { Injectable } from '@nestjs/common';
import { CloudStorageInterface } from './cloud-storage.interface';
import { CosStorageProvider } from './cos-storage.provider';
import { OssStorageProvider } from './oss-storage.provider';
import { QiniuStorageProvider } from './qiniu-storage.provider';
import { StorageConfig, StorageType } from '../entities/storage-config.entity';

/**
 * 云存储工厂类
 */
@Injectable()
export class CloudStorageFactory {
  constructor(
    private readonly cosProvider: CosStorageProvider,
    private readonly ossProvider: OssStorageProvider,
    private readonly qiniuProvider: QiniuStorageProvider,
  ) {}

  /**
   * 创建云存储提供商实例
   * @param config 存储配置
   * @returns 云存储提供商实例
   */
  create(config: StorageConfig): CloudStorageInterface {
    let provider: CloudStorageInterface;

    switch (config.type) {
      case StorageType.COS:
        provider = this.cosProvider;
        break;
      case StorageType.OSS:
        provider = this.ossProvider;
        break;
      case StorageType.QINIU:
        provider = this.qiniuProvider;
        break;
      default:
        throw new Error(`不支持的存储类型: ${config.type}`);
    }

    // 初始化提供商
    (provider as any).initialize(config);
    
    return provider;
  }
} 