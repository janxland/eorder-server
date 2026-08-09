import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * KeyVaultService —— 永久密钥的 AES-256-GCM 加解密
 * 主密钥 KEY_VAULT_MASTER_KEY 仅存服务器环境变量（32 字节 hex），不进 git、不进库。
 * 设计原则：明文只存在于服务端内存（签发 STS 瞬间），不落日志、不落响应、不落库。
 */
@Injectable()
export class KeyVaultService {
  private readonly logger = new Logger(KeyVaultService.name);
  private readonly masterKey: Buffer;

  constructor() {
    const hex = process.env.KEY_VAULT_MASTER_KEY;
    if (!hex) {
      // 开发环境兜底：从固定 dev key 派生（仅限 NODE_ENV !== production）
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('⚠️  KEY_VAULT_MASTER_KEY 未配置，使用开发兜底密钥（生产环境禁止！）');
        this.masterKey = crypto.createHash('sha256').update('dev-only-keyvault-key').digest();
      } else {
        throw new Error('KEY_VAULT_MASTER_KEY 必须配置（32字节 hex）');
      }
    } else {
      const normalized = hex.replace(/^0x/, '');
      this.masterKey = Buffer.from(normalized, 'hex');
      if (this.masterKey.length !== 32) {
        throw new Error(`KEY_VAULT_MASTER_KEY 必须是 32 字节 hex（当前 ${this.masterKey.length} 字节）`);
      }
    }
  }

  /**
   * AES-256-GCM 加密
   * 输出格式: base64( iv(12) || authTag(16) || ciphertext )
   */
  encrypt(plaintext: string): string {
    if (plaintext == null) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /**
   * AES-256-GCM 解密
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return null;
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < 28) {
      this.logger.error('密文长度异常，无法解密');
      return null;
    }
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e) {
      this.logger.error(`解密失败: ${e.message}`);
      return null;
    }
  }

  /** 掩码工具：只显示末 4 位 */
  maskSecret(value: string): string {
    if (!value) return '';
    return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
  }
}
