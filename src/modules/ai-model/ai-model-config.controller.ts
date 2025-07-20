import { Controller, Get, Post, Body, Put, Param, Delete, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AIModelConfigService } from './ai-model-config.service';
import { CreateAIModelConfigDto, UpdateAIModelConfigDto, TestAIModelConfigDto } from './dto/ai-model-config.dto';
import { AIModelConfig } from './entities/ai-model-config.entity';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('ai-model-config')
// @UseGuards(AuthCenterGuard)
export class AIModelConfigController {
  constructor(private readonly aiModelConfigService: AIModelConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SUPER_ADMIN')
  async create(@Body() createDto: CreateAIModelConfigDto): Promise<any> {
    const config = await this.aiModelConfigService.create(createDto);
    return config;
  }

  @Get()
  @Roles('SUPER_ADMIN')
  async findAll(): Promise<any> {
    const configs = await this.aiModelConfigService.findAll();
    return configs;
  }

  @Get('default')
  @Roles('SUPER_ADMIN')
  async findDefault(): Promise<any> {
    const config = await this.aiModelConfigService.findDefault();
    return config;
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  async findOne(@Param('id') id: string): Promise<any> {
    const config = await this.aiModelConfigService.findOne(+id);
    return config;
  }

  @Put(':id')
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAIModelConfigDto): Promise<any> {
    const config = await this.aiModelConfigService.update(+id, updateDto);
    return config;
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string): Promise<any> {
    await this.aiModelConfigService.remove(+id);
    return { success: true };
  }

  @Put(':id/default')
  @Roles('SUPER_ADMIN')
  async setDefault(@Param('id') id: string): Promise<any> {
    const config = await this.aiModelConfigService.setDefault(+id);
    return config;
  }

  @Put(':id/status')
  @Roles('SUPER_ADMIN')
  async changeStatus(@Param('id') id: string, @Body('isEnabled') isEnabled: boolean): Promise<any> {
    const config = await this.aiModelConfigService.changeStatus(+id, isEnabled);
    return config;
  }

  @Post('test-connection')
  @Roles('SUPER_ADMIN')
  async testConnection(@Body() testDto: TestAIModelConfigDto): Promise<any> {
    const result = await this.aiModelConfigService.testConnection(testDto);
    return result;
  }
} 