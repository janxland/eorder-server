import { Injectable, Logger } from '@nestjs/common';
import * as OSS from 'ali-oss';
import { CloudStorageInterface } from './cloud-storage.interface';
import { StorageConfig } from '../entities/storage-config.entity';

@Injectable()
export class OssStorageProvider implements CloudStorageInterface {
  private client: OSS;
  private config: StorageConfig;
  private readonly logger = new Logger(OssStorageProvider.name);
  
  constructor() {}

  /**
   * 初始化OSS客户端
   * @param config 存储配置
   */
  initialize(config: StorageConfig): void {
    this.config = config;
    this.client = new OSS({
      accessKeyId: config.accessKey,
      accessKeySecret: config.secretKey,
      bucket: config.bucket,
      region: config.region,
      endpoint: config.endpoint,
    });
  }

  /**
   * 获取上传凭证
   * @param key 文件路径
   * @param expires 过期时间（秒）
   */
  async getUploadToken(key: string, expires = 3600): Promise<any> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    try {
      // 阿里云OSS使用签名URL进行上传
      const url = this.client.signatureUrl(fullKey, {
        method: 'PUT',
        expires,
      });

      return {
        url,
      };
    } catch (error) {
      throw new Error(`获取OSS上传凭证失败: ${error.message}`);
    }
  }

  /**
   * 获取上传URL
   * @param key 文件路径
   * @param expires 过期时间（秒）
   */
  async getUploadUrl(key: string, expires = 3600): Promise<string> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    try {
      return this.client.signatureUrl(fullKey, {
        method: 'PUT',
        expires,
      });
    } catch (error) {
      throw new Error(`获取OSS上传URL失败: ${error.message}`);
    }
  }

  /**
   * 获取文件访问URL
   * @param key 文件路径
   * @param expires 过期时间（秒），私有读取时需要
   */
  async getFileUrl(key: string, expires = 3600): Promise<string> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    // 如果配置了自定义域名且不是私有读取，则直接返回URL
    if (this.config.domain && !this.config.isPrivate) {
      return `${this.config.domain}/${fullKey}`;
      }
      
    try {
      return this.client.signatureUrl(fullKey, {
        expires: this.config.isPrivate ? expires : undefined,
      });
    } catch (error) {
      throw new Error(`获取OSS文件URL失败: ${error.message}`);
    }
  }

  /**
   * 删除文件
   * @param key 文件路径
   */
  async deleteFile(key: string): Promise<boolean> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    try {
      await this.client.delete(fullKey);
      return true;
    } catch (error) {
      throw new Error(`删除OSS文件失败: ${error.message}`);
    }
  }
  
  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 尝试列出Bucket下的文件，只获取一个
      await this.client.list({
        'max-keys': 1,
      });
      return true;
    } catch (error) {
      console.error('OSS连接测试失败:', error);
      return false;
    }
  }

  /**
   * 生成临时密钥
   * @param prefix 文件路径前缀
   * @param expires 过期时间（秒）
   */
  async generateTempCredentials(prefix?: string, expires = 1800): Promise<any> {
    this.logger.debug(`生成临时密钥: prefix=${prefix}, expires=${expires}`);
    
    // 阿里云OSS临时密钥实现
    // 目前仅返回一个占位符实现，实际项目中需要使用阿里云STS服务
    throw new Error('阿里云OSS临时密钥功能尚未实现');
  }
} 