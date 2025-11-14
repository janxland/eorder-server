import { Controller, Get, Post, Body, Put, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { CreateAppConfigDto, UpdateAppConfigDto, SearchAppConfigDto } from './dto/app-config.dto';
import { AppConfig } from './entities/app-config.entity';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { PermissionCodeGuard } from '../../common/guards/permission-code.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionCode } from '../../common/enums/permission-code.enum';

@Controller('app-config')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionCode.CREATE_APP_CONFIG)
  async create(@Body() createDto: CreateAppConfigDto): Promise<any> {
    const config = await this.appConfigService.create(createDto);
    // 创建后返回时过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }

  @Get()
  @RequirePermission(PermissionCode.SHOW_APP_CONFIG_LIST)
  async findAll(@Query() search: SearchAppConfigDto): Promise<any> {
    const configs = await this.appConfigService.findAll(search);
    // 列表查询时过滤敏感字段
    return configs.map(config => this.appConfigService.excludeSensitiveFields(config));
  }

  @Get('default')
  @RequirePermission(PermissionCode.SHOW_APP_CONFIG_LIST)
  async findDefault(): Promise<any> {
    const config = await this.appConfigService.findDefault();
    // 默认配置查询时也过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }

  @Get('search/name')
  @RequirePermission(PermissionCode.SHOW_APP_CONFIG_LIST)
  async findByName(@Query('name') name: string): Promise<any> {
    const config = await this.appConfigService.findByName(name);
    // 按名称查询时也过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }

  @Get(':id')
  @RequirePermission(PermissionCode.SHOW_APP_CONFIG_DETAIL)
  async findOne(@Param('id') id: string): Promise<AppConfig> {
    // 单独查询时返回完整的信息（包括敏感字段）
    return this.appConfigService.findOne(+id);
  }

  @Put(':id')
  @RequirePermission(PermissionCode.UPDATE_APP_CONFIG)
  async update(@Param('id') id: string, @Body() updateDto: UpdateAppConfigDto): Promise<any> {
    const config = await this.appConfigService.update(+id, updateDto);
    // 更新后返回时过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }

  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_APP_CONFIG)
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.appConfigService.remove(+id);
    return { success: true };
  }

  @Put(':id/default')
  @RequirePermission(PermissionCode.UPDATE_APP_CONFIG)
  async setDefault(@Param('id') id: string): Promise<any> {
    const config = await this.appConfigService.setDefault(+id);
    // 设置默认后返回时过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }

  @Put(':id/status')
  @RequirePermission(PermissionCode.UPDATE_APP_CONFIG)
  async changeStatus(@Param('id') id: string, @Body('isEnabled') isEnabled: boolean): Promise<any> {
    const config = await this.appConfigService.changeStatus(+id, isEnabled);
    // 修改状态后返回时过滤敏感字段
    return this.appConfigService.excludeSensitiveFields(config);
  }
} 