/**
 * 云存储配置接口
 */
export interface CloudStorageConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  domain?: string;
  extraConfig?: Record<string, any>;
}

/**
 * 上传文件选项接口
 */
export interface UploadOptions {
  key?: string;
  mimeType?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  timeout?: number;
}

/**
 * 云存储提供商接口
 */
export interface ICloudStorageProvider {
  /**
   * 测试连接
   */
  testConnection(): Promise<boolean>;
  
  /**
   * 获取上传凭证
   */
  getUploadToken(key?: string, expires?: number): Promise<string>;
  
  /**
   * 获取临时上传URL
   */
  getUploadUrl(key: string, expires?: number): Promise<string>;
  
  /**
   * 获取文件访问URL
   */
  getFileUrl(key: string, expires?: number): Promise<string>;
  
  /**
   * 上传文件
   */
  uploadFile(fileBuffer: Buffer, key: string, options?: UploadOptions): Promise<string>;
  
  /**
   * 删除文件
   */
  deleteFile(key: string): Promise<boolean>;

  /**
   * 生成临时密钥
   */
  generateTempCredentials?(prefix?: string, expires?: number): Promise<any>;
} 

export interface CloudStorageInterface {
  /**
   * 初始化
   */
  initialize(config: any): void;
  
  /**
   * 测试连接
   */
  testConnection(): Promise<boolean>;
  
  /**
   * 获取上传凭证
   */
  getUploadToken(key?: string, expires?: number): Promise<string>;

  /**
   * 获取上传URL
   */
  getUploadUrl(key: string, expires?: number): Promise<string>;

  /**
   * 获取文件访问URL
   */
  getFileUrl(key: string, expires?: number): Promise<string>;

  /**
   * 删除文件
   */
  deleteFile(key: string): Promise<boolean>;

  /**
   * 生成临时密钥
   * @param prefix 文件路径前缀
   * @param expires 过期时间（秒）
   */
  generateTempCredentials(prefix?: string, expires?: number): Promise<any>;
} 