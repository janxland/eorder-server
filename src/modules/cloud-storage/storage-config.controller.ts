import { 
  Body, 
  Controller, 
  Delete, 
  Get, 
  Param, 
  ParseIntPipe, 
  Post, 
  Put, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { StorageConfigService } from './storage-config.service';
import { CreateStorageConfigDto, TestStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { StorageConfig, StorageProviderType } from './entities/storage-config.entity';
import { JwtGuard } from '@/common/guards';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('cloud-storage/config')
@UseGuards(JwtGuard)
export class StorageConfigController {
  constructor(private readonly storageConfigService: StorageConfigService) {}

  /**
   * 创建云存储配置
   */
  @Post()
  @Roles('admin')
  async create(@Body() createDto: CreateStorageConfigDto): Promise<StorageConfig> {
    return this.storageConfigService.create(createDto);
  }

  /**
   * 获取所有云存储配置
   */
  @Get()
  @Roles('admin')
  async findAll(): Promise<StorageConfig[]> {
    return this.storageConfigService.findAll();
  }

  /**
   * 根据ID获取云存储配置
   */
  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<StorageConfig> {
    return this.storageConfigService.findOne(id);
  }

  /**
   * 获取指定类型的所有可用配置
   */
  @Get('by-type/:provider')
  async findAllByType(@Param('provider') provider: StorageProviderType): Promise<StorageConfig[]> {
    return this.storageConfigService.findAllByType(provider);
  }

  /**
   * 更新云存储配置
   */
  @Put(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateStorageConfigDto,
  ): Promise<StorageConfig> {
    return this.storageConfigService.update(id, updateDto);
  }

  /**
   * 删除云存储配置
   */
  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.storageConfigService.remove(id);
  }

  /**
   * 测试云存储配置连接
   */
  @Post('test-connection')
  @Roles('admin')
  async testConnection(@Body() testDto: TestStorageConfigDto): Promise<{ success: boolean; message: string }> {
    return this.storageConfigService.testConnection(testDto);
  }
} 