import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req } from '@nestjs/common';
import { StorageConfigService } from './storage-config.service';
import { CloudStorageService } from './cloud-storage.service';
import { CreateStorageConfigDto, TestStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { StorageConfig } from './entities/storage-config.entity';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';

@Controller('cloud-storage/config')
@UseGuards(AuthCenterGuard)
export class StorageConfigController {
  constructor(
    private readonly storageConfigService: StorageConfigService,
    private readonly cloudStorageService: CloudStorageService,
  ) {}

  /**
   * 获取所有存储配置
   */
  @Get()
  async findAll(@Req() req: any): Promise<{ }> {
    const userId = req.user?.userId;
    const configs = await this.storageConfigService.findAll(userId);
    return configs;
  }

  /**
   * 获取单个存储配置
   */
  @Get(':id')
  async findOne(@Param('id') id: number, @Req() req: any): Promise<{ }> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.findById(+id, userId);
    return config;
  }

  /**
   * 创建存储配置
   */
  @Post()
  async create(@Body() createDto: CreateStorageConfigDto, @Req() req: any): Promise<{ }> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.create(createDto, userId);
    return config;
  }

  /**
   * 更新存储配置
   */
  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateStorageConfigDto,
    @Req() req: any
  ): Promise<{}> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.update(+id, updateDto, userId);
    return config;
  }

  /**
   * 删除存储配置
   */
  @Delete(':id')
  async remove(@Param('id') id: number, @Req() req: any): Promise<{ success: boolean }> {
    const userId = req.user?.userId;
    const result = await this.storageConfigService.remove(+id, userId);
    return {
      success: result,
    };
  }

  /**
   * 设置默认配置
   */
  @Put(':id/default')
  async setDefault(@Param('id') id: number, @Req() req: any): Promise<{ }> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.setDefault(+id, userId);
    return config;
  }

  /**
   * 更改配置启用状态
   */
  @Put(':id/status')
  async changeStatus(
    @Param('id') id: number,
    @Body('isEnabled') isEnabled: boolean,
    @Req() req: any
  ): Promise<{ }> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.changeStatus(+id, isEnabled, userId);
    return config;
  }

  /**
   * 测试连接
   */
  @Post('test-connection')
  async testConnection(@Body() testDto: TestStorageConfigDto, @Req() req: any): Promise<{  }> {
    const userId = req.user?.userId;
    const result = await this.storageConfigService.testConnection(testDto, userId);
    return {
      success: true,
      ...result,
    };
  }
} 