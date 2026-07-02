import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req } from '@nestjs/common';
import { StorageConfigService } from './storage-config.service';
import { CloudStorageService } from './cloud-storage.service';
import { CreateStorageConfigDto, TestStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { StorageConfig } from './entities/storage-config.entity';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { PermissionCodeGuard } from '../../common/guards/permission-code.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionCode } from '../../common/enums/permission-code.enum';

@Controller('cloud-storage/config')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class StorageConfigController {
  constructor(
    private readonly storageConfigService: StorageConfigService,
    private readonly cloudStorageService: CloudStorageService,
  ) {}

  /**
   * 获取所有存储配置
   */
  @Get()
  @RequirePermission(PermissionCode.SHOW_STORAGE_CONFIG_LIST)
  async findAll(@Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    const configs = await this.storageConfigService.findAll(userId);
    // 列表查询时过滤敏感字段
    return configs.map(config => this.storageConfigService.excludeSensitiveFields(config));
  }

  /**
   * 获取单个存储配置
   */
  @Get(':id')
  @RequirePermission(PermissionCode.SHOW_STORAGE_CONFIG_DETAIL)
  async findOne(@Param('id') id: number, @Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    const roleCodes: string[] = req.user?.roleCodes || [];
    const config = await this.storageConfigService.findById(+id, userId);

    // 仅超级管理员可查看完整密钥
    if (roleCodes.includes('SUPER_ADMIN')) {
      return config;
    }

    return this.storageConfigService.excludeSensitiveFields(config);
  }

  /**
   * 创建存储配置
   */
  @Post()
  @RequirePermission(PermissionCode.CREATE_STORAGE_CONFIG)
  async create(@Body() createDto: CreateStorageConfigDto, @Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.create(createDto, userId);
    // 创建后返回时过滤敏感字段
    return this.storageConfigService.excludeSensitiveFields(config);
  }

  /**
   * 更新存储配置
   */
  @Put(':id')
  @RequirePermission(PermissionCode.UPDATE_STORAGE_CONFIG)
  async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateStorageConfigDto,
    @Req() req: any
  ): Promise<any> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.update(+id, updateDto, userId);
    // 更新后返回时过滤敏感字段
    return this.storageConfigService.excludeSensitiveFields(config);
  }

  /**
   * 删除存储配置
   */
  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_STORAGE_CONFIG)
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
  @RequirePermission(PermissionCode.UPDATE_STORAGE_CONFIG)
  async setDefault(@Param('id') id: number, @Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.setDefault(+id, userId);
    // 设置默认后返回时过滤敏感字段
    return this.storageConfigService.excludeSensitiveFields(config);
  }

  /**
   * 更改配置启用状态
   */
  @Put(':id/status')
  @RequirePermission(PermissionCode.UPDATE_STORAGE_CONFIG)
  async changeStatus(
    @Param('id') id: number,
    @Body('isEnabled') isEnabled: boolean,
    @Req() req: any
  ): Promise<any> {
    const userId = req.user?.userId;
    const config = await this.storageConfigService.changeStatus(+id, isEnabled, userId);
    // 修改状态后返回时过滤敏感字段
    return this.storageConfigService.excludeSensitiveFields(config);
  }

  /**
   * 测试连接
   */
  @Post('test-connection')
  @RequirePermission(PermissionCode.SHOW_STORAGE_CONFIG_DETAIL)
  async testConnection(@Body() testDto: TestStorageConfigDto, @Req() req: any): Promise<any> {
    const userId = req.user?.userId;
    const result = await this.storageConfigService.testConnection(testDto, userId);
    return {
      success: true,
      ...result,
    };
  }
} 