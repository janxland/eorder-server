import { Injectable, Logger } from '@nestjs/common';
import * as COS from 'cos-nodejs-sdk-v5';
import * as STS from 'qcloud-cos-sts';
import { CloudStorageInterface } from './cloud-storage.interface';
import { StorageConfig } from '../entities/storage-config.entity';

// STS类型定义
interface STSCredentials {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
}

interface STSResult {
  credentials: STSCredentials;
  startTime: number;
  expiredTime: number;
}

@Injectable()
export class CosStorageProvider implements CloudStorageInterface {
  private client: COS;
  private config: StorageConfig;
  private readonly logger = new Logger(CosStorageProvider.name);
  
  constructor() {}

  /**
   * 初始化COS客户端
   * @param config 存储配置
   */
  initialize(config: StorageConfig): void {
    this.config = config;
    this.client = new COS({
      SecretId: config.accessKey,
      SecretKey: config.secretKey,
      FileParallelLimit: 3,
      ChunkParallelLimit: 8,
      ChunkSize: 1024 * 1024 * 8,
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
      
    return new Promise((resolve, reject) => {
      this.client.getObjectUrl({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: fullKey,
        Method: 'PUT',
        Expires: expires,
        Sign: true,
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          url: data.Url,
        });
      });
    });
  }

  /**
   * 获取上传URL
   * @param key 文件路径
   * @param expires 过期时间（秒）
   */
  async getUploadUrl(key: string, expires = 3600): Promise<string> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;
      
    return new Promise((resolve, reject) => {
      this.client.getObjectUrl({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: fullKey,
        Method: 'PUT',
        Expires: expires,
        Sign: true,
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.Url);
      });
    });
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
          
    return new Promise((resolve, reject) => {
      this.client.getObjectUrl({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: fullKey,
        Sign: this.config.isPrivate,
        Expires: this.config.isPrivate ? expires : undefined,
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.Url);
      });
    });
  }

  /**
   * 删除文件
   * @param key 文件路径
   */
  async deleteFile(key: string): Promise<boolean> {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : '';
    const fullKey = `${prefix}${key}`;

    return new Promise((resolve, reject) => {
      this.client.deleteObject({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: fullKey,
      }, (err, data) => {
        if (err) {
          reject(err);
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
    return new Promise((resolve, reject) => {
      this.client.headBucket({
        Bucket: this.config.bucket,
        Region: this.config.region,
      }, (err, data) => {
        if (err) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  /**
   * 生成临时密钥
   * @param prefix 文件路径前缀，例如：upload/article/202405/
   * @param expires 过期时间（秒）
   */
  async generateTempCredentials(prefix?: string, expires = 1800): Promise<any> {
    this.logger.debug(`生成临时密钥: prefix=${prefix}, expires=${expires}`);
    
    // 处理前缀
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
      
      // 替换模板标记
      prefix = this.replaceTemplatePlaceholders(prefix);
      
      resourcePrefix = prefix.substring(1); // 去掉开头的/
    } else if (this.config.prefix) {
      // 使用配置中的前缀，并替换模板标记
      let configPrefix = this.config.prefix;
      if (!configPrefix.endsWith('/')) {
        configPrefix = configPrefix + '/';
      }
      
      resourcePrefix = this.replaceTemplatePlaceholders(configPrefix);
    }

    this.logger.debug(`最终资源前缀: ${resourcePrefix}`);

    try {
      const stsConfig = {
        secretId: this.config.accessKey,
        secretKey: this.config.secretKey,
        policy: {
          version: '2.0',
          statement: [
            {
              effect: 'allow',
              action: [
                // 列目录（项目管理页依赖 getBucket）
                'cos:GetBucket',
                'cos:HeadBucket',
                // 对象上传
                'cos:GetObject', 
                'cos:PostObject',
                'cos:PutObject',
                // 分块上传
                'cos:InitiateMultipartUpload',
                'cos:ListMultipartUploads',
                'cos:ListParts',
                'cos:UploadPart',
                'cos:CompleteMultipartUpload',
                'cos:AbortMultipartUpload'
              ],
              resource: [
                '*'
              ]
            }
          ]
        },
        durationSeconds: expires,
        region: this.config.region,
        endpoint: 'sts.tencentcloudapi.com',
      };
      
      const stsResult: STSResult = await new Promise((resolve, reject) => {
        this.logger.debug(`正在调用STS服务获取临时密钥...`);
        STS.getCredential(stsConfig, (err, data) => {
          if (err) {
            this.logger.error(`STS生成临时密钥失败: ${err instanceof Error ? err.message : String(err)}`);
            reject(err);
            return;
          }
          this.logger.debug(`STS临时密钥获取成功`);
          resolve(data as STSResult);
        });
      });

      return {
        secretId: stsResult.credentials.tmpSecretId,
        secretKey: stsResult.credentials.tmpSecretKey,
        sessionToken: stsResult.credentials.sessionToken,
        startTime: stsResult.startTime,
        expiredTime: stsResult.expiredTime,
        bucket: this.config.bucket,
        region: this.config.region,
        domain: this.config.domain,
        cdnDomain: this.config.cdnDomain,
        prefix: resourcePrefix,
      };
    } catch (error) {
      this.logger.error(`生成临时密钥失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * 替换前缀中的模板标记
   * @param template 包含模板标记的字符串
   * @returns 替换后的字符串
   */
  private replaceTemplatePlaceholders(template: string): string {
    const now = new Date();
    
    // 替换{YYYY}为四位年份
    template = template.replace(/{YYYY}/gi, now.getFullYear().toString());
    
    // 替换{MM}为两位月份
    const month = now.getMonth() + 1;
    template = template.replace(/{MM}/gi, month < 10 ? `0${month}` : month.toString());
    
    // 替换{DD}为两位日期
    const day = now.getDate();
    template = template.replace(/{DD}/gi, day < 10 ? `0${day}` : day.toString());
    
    // 替换{YYYYMM}为年月组合
    const yearMonth = `${now.getFullYear()}${month < 10 ? `0${month}` : month.toString()}`;
    template = template.replace(/{YYYYMM}/gi, yearMonth);
    
    // 替换{YYYYMMDD}为年月日组合
    const yearMonthDay = `${yearMonth}${day < 10 ? `0${day}` : day.toString()}`;
    template = template.replace(/{YYYYMMDD}/gi, yearMonthDay);
    
    return template;
  }
} 