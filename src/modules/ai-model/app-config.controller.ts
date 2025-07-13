import { Controller, Get, Post, Body, Put, Param, Delete, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { CreateAppConfigDto, UpdateAppConfigDto, SearchAppConfigDto } from './dto/app-config.dto';
import { AppConfig } from './entities/app-config.entity';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateAppConfigDto): Promise<AppConfig> {
    return this.appConfigService.create(createDto);
  }

  @Get()
  async findAll(@Query() search: SearchAppConfigDto): Promise<AppConfig[]> {
    return this.appConfigService.findAll(search);
  }

  @Get('default')
  async findDefault(): Promise<AppConfig> {
    return this.appConfigService.findDefault();
  }

  @Get('search/name')
  async findByName(@Query('name') name: string): Promise<AppConfig> {
    return this.appConfigService.findByName(name);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AppConfig> {
    return this.appConfigService.findOne(+id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAppConfigDto): Promise<AppConfig> {
    return this.appConfigService.update(+id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.appConfigService.remove(+id);
    return { success: true };
  }

  @Put(':id/default')
  async setDefault(@Param('id') id: string): Promise<AppConfig> {
    return this.appConfigService.setDefault(+id);
  }

  @Put(':id/status')
  async changeStatus(@Param('id') id: string, @Body('isEnabled') isEnabled: boolean): Promise<AppConfig> {
    return this.appConfigService.changeStatus(+id, isEnabled);
  }
} 