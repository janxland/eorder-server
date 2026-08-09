import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageAccount } from './storage-account.entity';
import { KeyVaultService } from '../keyvault/keyvault.service';
import { CreateStorageAccountDto, UpdateStorageAccountDto } from './dto/storage-account.dto';

/**
 * 云存储账号管理
 * - 永久密钥 AES-256-GCM 加密存储（accessKeyEnc/secretKeyEnc，select:false）
 * - 对外接口一律脱敏，只显示 id/name/provider/末4位
 * - 解密仅服务内部使用（签发 STS 时）
 */
@Injectable()
export class StorageAccountService {
  private readonly logger = new Logger(StorageAccountService.name);

  constructor(
    @InjectRepository(StorageAccount)
    private readonly accountRepository: Repository<StorageAccount>,
    private readonly keyVaultService: KeyVaultService,
  ) {}

  /** 脱敏输出（对外）；exposePlain=true 时返回明文（仅 SUPER_ADMIN 详情） */
  toSafe(account: StorageAccount, accessKey?: string, secretKey?: string, exposePlain = false) {
    return {
      id: account.id,
      name: account.name,
      provider: account.provider,
      accessKeyMasked: this.keyVaultService.maskSecret(accessKey),
      secretKeyMasked: this.keyVaultService.maskSecret(secretKey),
      hasAccessKey: !!accessKey,
      hasSecretKey: !!secretKey,
      // 仅详情且 SUPER_ADMIN 时暴露明文（用于忘记密钥时的查询）
      ...(exposePlain
        ? { accessKey: accessKey || null, secretKey: secretKey || null }
        : {}),
      remark: account.remark,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async findAll(): Promise<any[]> {
    const accounts = await this.accountRepository.find();
    // 解密末4位用于展示（内存中解密，不落响应明文）
    return accounts.map((a) => {
      const ak = this.keyVaultService.decrypt(a.accessKeyEnc?.toString() || '');
      const sk = this.keyVaultService.decrypt(a.secretKeyEnc?.toString() || '');
      return this.toSafe(a, ak, sk);
    });
  }

  async findById(id: number): Promise<StorageAccount> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) throw new NotFoundException(`账号不存在: id=${id}`);
    return account;
  }

  /** 服务内部：解密后的完整凭证（仅签发 STS 用，绝不对外） */
  async getCredentials(id: number): Promise<{ accessKey: string; secretKey: string }> {
    const account = await this.accountRepository.findOne({
      where: { id },
      select: ['id', 'accessKeyEnc', 'secretKeyEnc'],
    });
    if (!account) throw new NotFoundException(`账号不存在: id=${id}`);
    const accessKey = this.keyVaultService.decrypt(account.accessKeyEnc?.toString() || '');
    const secretKey = this.keyVaultService.decrypt(account.secretKeyEnc?.toString() || '');
    if (!accessKey || !secretKey) {
      throw new BadRequestException('账号密钥解密失败，请检查 KEY_VAULT_MASTER_KEY');
    }
    return { accessKey, secretKey };
  }

  async create(dto: CreateStorageAccountDto): Promise<any> {
    const account = this.accountRepository.create({
      name: dto.name,
      provider: dto.provider || 'cos',
      accessKeyEnc: Buffer.from(this.keyVaultService.encrypt(dto.accessKey), 'utf8'),
      secretKeyEnc: Buffer.from(this.keyVaultService.encrypt(dto.secretKey), 'utf8'),
      remark: dto.remark,
    });
    const saved = await this.accountRepository.save(account);
    this.logger.log(`云存储账号已创建: id=${saved.id}, name=${saved.name}`);
    return this.toSafe(saved, dto.accessKey, dto.secretKey);
  }

  async update(id: number, dto: UpdateStorageAccountDto): Promise<any> {
    const account = await this.findById(id);
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.remark !== undefined) account.remark = dto.remark;
    // 密钥轮换：只填 accessKey/secretKey 任意一个时，另一个保持不变
    if (dto.accessKey || dto.secretKey) {
      const current = await this.getCredentials(id);
      const newAk = dto.accessKey || current.accessKey;
      const newSk = dto.secretKey || current.secretKey;
      account.accessKeyEnc = Buffer.from(this.keyVaultService.encrypt(newAk), 'utf8');
      account.secretKeyEnc = Buffer.from(this.keyVaultService.encrypt(newSk), 'utf8');
      this.logger.warn(`云存储账号密钥已轮换: id=${id}`);
    }
    const saved = await this.accountRepository.save(account);
    return this.toSafe(saved);
  }

  async remove(id: number): Promise<boolean> {
    const account = await this.findById(id);
    // 检查是否被配置引用（防止误删）
    const configCount = await this.accountRepository.manager
      .query('SELECT COUNT(*) as c FROM storage_config WHERE account_id = ?', [id]);
    const count = Number(configCount[0]?.c || 0);
    if (count > 0) {
      throw new BadRequestException(`该账号被 ${count} 个存储配置引用，请先解除引用`);
    }
    await this.accountRepository.remove(account);
    this.logger.warn(`云存储账号已删除: id=${id}`);
    return true;
  }
}
