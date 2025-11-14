import { Body, Controller, Delete, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { CloudStorageService } from './cloud-storage.service';
import { UploadDto } from './dto/storage-config.dto';
import { AuthCenterGuard } from '../../common/guards/auth-center.guard';
import { PermissionCodeGuard } from '../../common/guards/permission-code.guard';
import { StorageConfigService } from './storage-config.service';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PermissionCode } from '../../common/enums/permission-code.enum';

@Controller('cloud-storage')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class CloudStorageController {
  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly storageConfigService: StorageConfigService,
  ) {}

  /**
   * 获取上传凭证
   */
  @Post('token')
  @RequirePermission(PermissionCode.GET_UPLOAD_TOKEN)
  async getUploadToken(@Body() uploadDto: UploadDto, @Req() req: any) {
    const userId = req.user?.userId;
    const token = await this.cloudStorageService.getUploadToken(uploadDto, userId);
    return {
      success: true,
      data: token,
    };
  }

  /**
   * 获取上传URL
   */
  @Get('upload-url')
  @RequirePermission(PermissionCode.GET_UPLOAD_URL)
  async getUploadUrl(@Query() uploadDto: UploadDto, @Req() req: any) {
    const userId = req.user?.userId;
    const url = await this.cloudStorageService.getUploadUrl(uploadDto, userId);
    return {
      success: true,
      data: url,
    };
  }

  /**
   * 获取临时密钥
   * @param req 请求对象
   * @param configId 存储配置ID，如果不指定则使用默认配置
   * @param configName 存储配置名称，如果指定则优先使用
   * @param prefix 文件路径前缀，例如：/upload/article/202405/
   */
  @Get('temp-credentials')
  @RequirePermission(PermissionCode.GET_TEMP_CREDENTIALS)
  async getTempCredentials(
    @Req() req: any,
    @Query('configId') configId?: number,
    @Query('configName') configName?: string,
    @Query('prefix') prefix?: string,
  ) {
    const userId = req.user?.userId;
    
    let config;
    
    // 优先通过配置名称查找
    if (configName) {
      config = await this.storageConfigService.findByName(configName, userId);
    }
    
    // 如果没有找到，则通过ID查找
    if (!config && configId) {
      config = await this.storageConfigService.findById(configId, userId);
    }
    
    // 如果仍然没有找到，则使用默认配置
    if (!config) {
      config = await this.storageConfigService.findDefault(userId);
    }
    
    if (!config) {
      return {
        success: false,
        message: '未找到有效的存储配置',
      };
    }
    
    // 生成临时密钥
    const credentials = await this.cloudStorageService.generateTempCredentials(config, prefix);
    
    return {
      success: true,
      ...credentials,
    };
  }

  /**
   * 获取文件URL
   */
  @Get('file-url')
  @RequirePermission(PermissionCode.GET_FILE_URL)
  async getFileUrl(
    @Query('key') key: string,
    @Query('configId') configId: number | undefined,
    @Req() req: any
  ) {
    const userId = req.user?.userId;
    const url = await this.cloudStorageService.getFileUrl(key, configId ? +configId : undefined, userId);
    return {
      success: true,
      url,
    };
  }

  /**
   * 删除文件
   */
  @Delete()
  @RequirePermission(PermissionCode.DELETE_FILE)
  async deleteFile(
    @Body('key') key: string,
    @Body('configId') configId: number | undefined,
    @Req() req: any
  ) {
    const userId = req.user?.userId;
    const result = await this.cloudStorageService.deleteFile(key, configId ? +configId : undefined, userId);
    return {
      success: result,
    };
  }
} 