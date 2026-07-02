/**
 * CDN 配置服务
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CdnConfig, CdnConfigDocument } from './cdn-config.entity';

@Injectable()
export class CdnConfigService {
  constructor(
    @InjectModel(CdnConfig.name)
    private cdnConfigModel: Model<CdnConfigDocument>,
  ) {}

  /**
   * 获取用户的所有 CDN 配置
   */
  async findAllByUser(userId: string): Promise<CdnConfig[]> {
    return this.cdnConfigModel.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).exec();
  }

  /**
   * 获取单个配置
   */
  async findById(id: string): Promise<CdnConfig> {
    const config = await this.cdnConfigModel.findById(id).exec();
    if (!config) throw new NotFoundException('CDN 配置不存在');
    return config;
  }

  /**
   * 创建 CDN 配置
   */
  async create(userId: string, dto: {
    name: string
    baseUrl: string
    apiKey: string
    model?: string
  }): Promise<CdnConfig> {
    if (!dto.name?.trim()) throw new BadRequestException('名称不能为空');
    if (!dto.baseUrl?.trim()) throw new BadRequestException('Base URL 不能为空');
    if (!dto.apiKey?.trim()) throw new BadRequestException('API Key 不能为空');

    // 如果是第一个配置，自动设为默认
    const count = await this.cdnConfigModel.countDocuments({ userId });
    const isDefault = count === 0;

    const config = new this.cdnConfigModel({
      userId,
      name: dto.name.trim(),
      baseUrl: dto.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: dto.apiKey.trim(),
      model: dto.model?.trim() || '',
      isDefault,
    });

    return config.save();
  }

  /**
   * 更新 CDN 配置
   */
  async update(id: string, dto: {
    name?: string
    baseUrl?: string
    apiKey?: string
    model?: string
    isDefault?: boolean
  }): Promise<CdnConfig> {
    const config = await this.findById(id);

    if (dto.name !== undefined) config.name = dto.name.trim();
    if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl.trim().replace(/\/+$/, '');
    if (dto.apiKey !== undefined) config.apiKey = dto.apiKey.trim();
    if (dto.model !== undefined) config.model = dto.model?.trim() || '';

    if (dto.isDefault) {
      // 取消其他默认
      await this.cdnConfigModel.updateMany(
        { userId: config.userId },
        { isDefault: false },
      );
      config.isDefault = true;
    }

    return config.save();
  }

  /**
   * 删除 CDN 配置
   */
  async delete(id: string): Promise<void> {
    const config = await this.findById(id);
    await this.cdnConfigModel.findByIdAndDelete(id);

    // 如果删除的是默认配置，把最新的设为默认
    if (config.isDefault) {
      const latest = await this.cdnConfigModel.findOne({ userId: config.userId }).sort({ createdAt: -1 });
      if (latest) {
        latest.isDefault = true;
        await latest.save();
      }
    }
  }

  /**
   * 获取用户默认配置
   */
  async getDefault(userId: string): Promise<CdnConfig | null> {
    return this.cdnConfigModel.findOne({ userId, isDefault: true });
  }
}
