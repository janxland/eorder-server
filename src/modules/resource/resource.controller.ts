import { Controller, Post, Delete, Param, Body, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('resources')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  /**
   * 上传文件资源
   * @param file 文件
   * @param resourceType 资源类型（如 'image', 'pdf', 'video' 等）
   * @returns 上传后的资源信息
   */
  @Post('upload')
  @RequirePermission(PermissionCode.UPLOAD_RESOURCE)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('resourceType') resourceType: string,
  ) {
    return this.resourceService.uploadFile(file, resourceType);
  }

  /**
   * 上传网络资源
   * @param url 网络资源 URL
   * @param resourceType 资源类型
   * @returns 上传后的网络资源信息
   */
  @Post('upload-url')
  @RequirePermission(PermissionCode.UPLOAD_RESOURCE)
  async uploadUrlResource(
    @Body('url') url: string,
    @Body('resourceType') resourceType: string,
  ) {
    return this.resourceService.uploadUrlResource(url, resourceType);
  }

  /**
   * 删除资源
   * @param id 资源ID
   */
  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_RESOURCE)
  async deleteResource(@Param('id') id: number) {
    await this.resourceService.deleteResource(id);
    return { message: 'Resource deleted successfully' };
  }

  /**
   * 获取资源的 URL
   * @param id 资源ID
   * @returns 资源的 URL
   */
  @Post(':id/url')
  @RequirePermission(PermissionCode.GET_RESOURCE_URL)
  async getResourceUrl(@Param('id') id: number) {
    const url = await this.resourceService.getResourceUrl(id);
    return { url };
  }
}
