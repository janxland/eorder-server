/**
 * CDN 配置控制器
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CdnConfigService } from './cdn-config.service';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';

@Controller('api/cdn/config')
@UseGuards(AuthCenterGuard)
export class CdnConfigController {
  constructor(private readonly cdnConfigService: CdnConfigService) {}

  private getUserId(req: Request): string {
    return (req as any).user?.userId;
  }

  /**
   * 获取用户所有 CDN 配置
   */
  @Get()
  async list(@Req() req: Request) {
    const configs = await this.cdnConfigService.findAllByUser(this.getUserId(req));
    return {
      success: true,
      data: configs.map(c => ({
        id: (c as any)._id?.toString(),
        name: c.name,
        baseUrl: c.baseUrl,
        apiKey: c.apiKey,
        model: c.model,
        isDefault: c.isDefault,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  /**
   * 创建 CDN 配置
   */
  @Post()
  async create(
    @Req() req: Request,
    @Body() body: { name: string; baseUrl: string; apiKey: string; model?: string },
  ) {
    const config = await this.cdnConfigService.create(this.getUserId(req), body);
    return {
      success: true,
      data: {
        id: (config as any)._id?.toString(),
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        isDefault: config.isDefault,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    };
  }

  /**
   * 更新 CDN 配置
   */
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name?: string; baseUrl?: string; apiKey?: string; model?: string; isDefault?: boolean },
  ) {
    const config = await this.cdnConfigService.update(id, body);
    return {
      success: true,
      data: {
        id: (config as any)._id?.toString(),
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        isDefault: config.isDefault,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    };
  }

  /**
   * 删除 CDN 配置
   */
  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    await this.cdnConfigService.delete(id);
    return { success: true };
  }

  /**
   * 设置默认 CDN
   */
  @Post(':id/default')
  async setDefault(@Req() req: Request, @Param('id') id: string) {
    await this.cdnConfigService.update(id, { isDefault: true });
    return { success: true };
  }
}
