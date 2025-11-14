import { Controller, Get, Post, Body, Put, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AIModelConfigService } from './ai-model-config.service';
import { CreateAIModelConfigDto, UpdateAIModelConfigDto, TestAIModelConfigDto } from './dto/ai-model-config.dto';
import { AIModelConfig } from './entities/ai-model-config.entity';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { PermissionCodeGuard } from '../../common/guards/permission-code.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionCode } from '../../common/enums/permission-code.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('ai-model-config')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class AIModelConfigController {
  constructor(private readonly aiModelConfigService: AIModelConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(PermissionCode.CREATE_AI_MODEL_CONFIG)
  async create(@Body() createDto: CreateAIModelConfigDto): Promise<any> {
    const config = await this.aiModelConfigService.create(createDto);
    // 创建后返回时也过滤 apiKey（除非是超级管理员）
    return this.aiModelConfigService.excludeApiKey(config);
  }

  @Get()
  @RequirePermission(PermissionCode.SHOW_AI_MODEL_CONFIG_LIST)
  async findAll(): Promise<any> {
    const configs = await this.aiModelConfigService.findAll();
    // 列表查询时过滤 apiKey
    return configs.map(config => this.aiModelConfigService.excludeApiKey(config));
  }

  @Get('default')
  @RequirePermission(PermissionCode.SHOW_AI_MODEL_CONFIG_LIST)
  async findDefault(): Promise<any> {
    const config = await this.aiModelConfigService.findDefault();
    // 默认配置查询时也过滤 apiKey
    return this.aiModelConfigService.excludeApiKey(config);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string): Promise<any> {
    // 单独查询时返回完整的 apiKey
    const config = await this.aiModelConfigService.findOne(+id);
    return config;
  }

  @Put(':id')
  @RequirePermission(PermissionCode.UPDATE_AI_MODEL_CONFIG)
  async update(@Param('id') id: string, @Body() updateDto: UpdateAIModelConfigDto): Promise<any> {
    const config = await this.aiModelConfigService.update(+id, updateDto);
    // 更新后返回时也过滤 apiKey
    return this.aiModelConfigService.excludeApiKey(config);
  }

  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_AI_MODEL_CONFIG)
  async remove(@Param('id') id: string): Promise<any> {
    await this.aiModelConfigService.remove(+id);
    return { success: true };
  }

  @Put(':id/default')
  @RequirePermission(PermissionCode.UPDATE_AI_MODEL_CONFIG)
  async setDefault(@Param('id') id: string): Promise<any> {
    const config = await this.aiModelConfigService.setDefault(+id);
    // 设置默认后返回时也过滤 apiKey
    return this.aiModelConfigService.excludeApiKey(config);
  }

  @Put(':id/status')
  @RequirePermission(PermissionCode.UPDATE_AI_MODEL_CONFIG)
  async changeStatus(@Param('id') id: string, @Body('isEnabled') isEnabled: boolean): Promise<any> {
    const config = await this.aiModelConfigService.changeStatus(+id, isEnabled);
    // 修改状态后返回时也过滤 apiKey
    return this.aiModelConfigService.excludeApiKey(config);
  }

  @Post('test-connection')
  @RequirePermission(PermissionCode.SHOW_AI_MODEL_CONFIG_DETAIL)
  async testConnection(@Body() testDto: TestAIModelConfigDto): Promise<any> {
    const result = await this.aiModelConfigService.testConnection(testDto);
    return result;
  }
} 