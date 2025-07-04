import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudStorageService } from './cloud-storage.service';
import {
  DeleteFileDto,
  GetFileUrlDto,
  GetUploadTokenDto,
  GetUploadUrlDto,
} from './dto/upload.dto';
import { JwtGuard } from '@/common/guards';
import { v4 as uuidv4 } from 'uuid';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('cloud-storage')
@UseGuards(JwtGuard)
export class CloudStorageController {
  constructor(private readonly cloudStorageService: CloudStorageService) {}

  /**
   * 获取上传凭证
   */
  @Get('token')
  async getUploadToken(@Query() query: GetUploadTokenDto): Promise<{ token: string }> {
    const token = await this.cloudStorageService.getUploadToken(
      query.provider,
      query.key,
      query.expires,
      query.configId,
    );
    return { token };
  }

  /**
   * 获取上传URL
   */
  @Get('upload-url')
  async getUploadUrl(@Query() query: GetUploadUrlDto): Promise<{ url: string }> {
    const url = await this.cloudStorageService.getUploadUrl(
      query.provider,
      query.key,
      query.expires,
      query.configId,
    );
    return { url };
  }

  /**
   * 获取文件URL
   */
  @Get('file-url')
  async getFileUrl(@Query() query: GetFileUrlDto): Promise<{ url: string }> {
    const url = await this.cloudStorageService.getFileUrl(
      query.provider,
      query.key,
      query.expires,
      query.configId,
    );
    return { url };
  }

  /**
   * 上传文件
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('provider') provider: string,
    @Body('key') key?: string,
    @Body('mimeType') mimeType?: string,
    @Body('configId') configId?: number,
  ): Promise<{ url: string }> {
    // 如果没有提供key，则生成一个唯一的文件名
    const fileKey = key || `${Date.now()}-${uuidv4()}`;
    
    const url = await this.cloudStorageService.uploadFile(
      provider as any,
      file.buffer,
      fileKey,
      {
        mimeType: mimeType || file.mimetype,
      },
      configId ? +configId : undefined,
    );
    
    return { url };
  }

  /**
   * 删除文件
   */
  @Delete()
  @Roles('admin')
  async deleteFile(@Body() deleteDto: DeleteFileDto): Promise<{ success: boolean }> {
    const result = await this.cloudStorageService.deleteFile(
      deleteDto.provider,
      deleteDto.key,
      deleteDto.configId,
    );
    return { success: result };
  }
} 