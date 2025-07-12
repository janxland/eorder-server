import { Injectable, Logger } from '@nestjs/common';
import * as qiniu from 'qiniu';
import { CloudStorageInterface } from './cloud-storage.interface';
import { StorageConfig } from '../entities/storage-config.entity';

@Injectable()
export class QiniuStorageProvider implements CloudStorageInterface {
  private mac: qiniu.auth.digest.Mac;
  private config: StorageConfig;
  private bucketManager: qiniu.rs.BucketManager;
  private readonly logger = new Logger(QiniuStorageProvider.name);

  constructor() {}

  /**
   * 初始化七牛云客户端
   * @param config 存储配置
   */
  initialize(config: StorageConfig): void {
    this.config = config;
    this.mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
    const qiniuConfig = new qiniu.conf.Config();
    
    // 设置区域
    qiniuConfig.zone = this.getZone(config.region);
    
    this.bucketManager = new qiniu.rs.BucketManager(this.mac, qiniuConfig);
  }

  /**
   * 获取上传凭证
   * @param key 文件路径
   * @param expires 过期时间（秒）
   */
  async getUploadToken(key: string, expires = 3600): Promise<any> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    // 创建上传策略
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${this.config.bucket}:${fullKey}`,
        expires,
    });

    // 生成上传凭证
    const uploadToken = putPolicy.uploadToken(this.mac);

    return {
      token: uploadToken,
      key: fullKey,
    };
  }

  /**
   * 获取上传URL
   * @param key 文件路径
   * @param expires 过期时间（秒）
   */
  async getUploadUrl(key: string, expires = 3600): Promise<string> {
    // 七牛云不支持直接获取上传URL，需要使用上传凭证
    // 这里返回七牛云的上传地址
    const uploadToken = await this.getUploadToken(key, expires);
    const uploadUrl = this.getUploadHost();
    
    return `${uploadUrl}?token=${encodeURIComponent(uploadToken.token)}&key=${encodeURIComponent(uploadToken.key)}`;
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
        
    // 如果是私有读取，生成带签名的URL
    if (this.config.isPrivate) {
          const deadline = Math.floor(Date.now() / 1000) + expires;
      const downloadUrl = this.getDownloadUrl(fullKey);
      
      // 使用七牛云的私有下载URL生成方法
      // 注意：这里需要根据实际的七牛云SDK版本调整
      return this.generatePrivateUrl(downloadUrl, deadline);
      }
      
    // 公开读取，直接返回URL
    return this.getDownloadUrl(fullKey);
  }

  /**
   * 删除文件
   * @param key 文件路径
   */
  async deleteFile(key: string): Promise<boolean> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    return new Promise((resolve, reject) => {
      this.bucketManager.delete(this.config.bucket, fullKey, (err) => {
        if (err) {
          reject(new Error(`删除七牛云文件失败: ${err.message}`));
          return;
        }
        resolve(true);
      });
    });
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      this.bucketManager.getBucketInfo(this.config.bucket, (err) => {
          if (err) {
          console.error('七牛云连接测试失败:', err);
          resolve(false);
            return;
          }
        resolve(true);
      });
    });
  }

  /**
   * 获取七牛云区域对象
   * @param region 区域代码
   */
  private getZone(region: string): qiniu.conf.Zone {
    switch (region) {
      case 'z0':
        return qiniu.zone.Zone_z0;
      case 'z1':
        return qiniu.zone.Zone_z1;
      case 'z2':
        return qiniu.zone.Zone_z2;
      case 'na0':
        return qiniu.zone.Zone_na0;
      case 'as0':
        return qiniu.zone.Zone_as0;
      default:
        return qiniu.zone.Zone_z0;
    }
  }

  /**
   * 获取上传域名
   */
  private getUploadHost(): string {
    // 这里简化处理，实际应该根据区域选择合适的上传域名
    return 'https://upload.qiniup.com';
  }

  /**
   * 获取下载URL
   * @param key 文件路径
   */
  private getDownloadUrl(key: string): string {
    // 优先使用自定义域名
    if (this.config.domain) {
      return `${this.config.domain}/${key}`;
    }

    // 使用默认域名
    return `http://${this.config.bucket}.qiniudn.com/${key}`;
  }
  
  /**
   * 生成私有下载URL
   * @param url 原始URL
   * @param deadline 过期时间戳
   */
  private generatePrivateUrl(url: string, deadline: number): string {
    // 构建访问参数
    const query = `e=${deadline}`;
    const urlToSign = url + (url.includes('?') ? '&' : '?') + query;
    
    // 计算签名
    const hmac = qiniu.util.hmacSha1(urlToSign, this.config.secretKey);
    const encodedSign = qiniu.util.base64ToUrlSafe(hmac);
    
    // 拼接最终URL
    return `${urlToSign}&token=${this.config.accessKey}:${encodedSign}`;
  }

  /**
   * 生成临时密钥
   * @param prefix 文件路径前缀
   * @param expires 过期时间（秒）
   */
  async generateTempCredentials(prefix?: string, expires = 1800): Promise<any> {
    this.logger.debug(`生成临时密钥: prefix=${prefix}, expires=${expires}`);
    
    // 确保前缀以/结尾
    let resourcePrefix = '';
    
    if (prefix) {
      // 确保前缀以/开头
      if (!prefix.startsWith('/')) {
        prefix = '/' + prefix;
      }
      // 确保前缀以/结尾
      if (!prefix.endsWith('/')) {
        prefix = prefix + '/';
      }
      resourcePrefix = prefix.substring(1); // 去掉开头的/
    } else if (this.config.prefix) {
      resourcePrefix = `${this.config.prefix}/`;
    }

    this.logger.debug(`最终资源前缀: ${resourcePrefix}`);

    try {
      // 创建上传策略
      const putPolicy = new qiniu.rs.PutPolicy({
        scope: `${this.config.bucket}:${resourcePrefix}*`,
        expires,
      });

      // 生成上传凭证
      const uploadToken = putPolicy.uploadToken(this.mac);

      // 构造返回结果
      const now = Math.floor(Date.now() / 1000);
      return {
        sessionToken: uploadToken,
        startTime: now,
        expiredTime: now + expires,
        bucket: this.config.bucket,
        region: this.config.region,
        domain: this.config.domain,
        prefix: resourcePrefix,
      };
    } catch (error) {
      this.logger.error(`生成临时密钥失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
} 