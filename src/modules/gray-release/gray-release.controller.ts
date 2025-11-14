/**
 * 灰度发布控制器
 * website: https://www.roginx.ink
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrayReleaseService } from './gray-release.service';
import {
  CreateGrayReleaseDto,
  BatchBindGrayReleaseDto,
  DeleteGrayReleaseDto,
  BatchDeleteGrayReleaseDto,
  QueryGrayReleaseDto,
  UpdateGrayReleaseDto,
} from './dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';
import { Public } from '@/common/decorators/public.decorator';

@Controller('gray-release')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class GrayReleaseController {
  constructor(private readonly grayReleaseService: GrayReleaseService) {}

  /**
   * 创建灰度白名单绑定
   */
  @Post()
  @RequirePermission(PermissionCode.CREATE_GRAY_RELEASE)
  async create(@Body() dto: CreateGrayReleaseDto) {
    return this.grayReleaseService.createGrayRelease(dto);
  }

  /**
   * 批量绑定灰度白名单
   */
  @Post('batch-bind')
  @RequirePermission(PermissionCode.BATCH_BIND_GRAY_RELEASE)
  async batchBind(@Body() dto: BatchBindGrayReleaseDto) {
    return this.grayReleaseService.batchBindGrayRelease(dto);
  }

  /**
   * 更新灰度白名单
   */
  @Put()
  @RequirePermission(PermissionCode.UPDATE_GRAY_RELEASE)
  async update(@Body() dto: UpdateGrayReleaseDto) {
    return this.grayReleaseService.updateGrayRelease(dto);
  }

  /**
   * 查询灰度白名单
   */
  @Get()
  @RequirePermission(PermissionCode.SHOW_GRAY_RELEASE_LIST)
  async query(@Query() dto: QueryGrayReleaseDto) {
    return this.grayReleaseService.queryGrayRelease(dto);
  }

  /**
   * 查询单个用户的灰度版本（供 Nginx 等外部服务调用，无需权限验证）
   */
  @Get('user-version/:appId/:userId')
  @Public()
  async getUserVersion(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
  ) {
    const version = await this.grayReleaseService.getUserGrayVersion(appId, userId);
    return {
      appId,
      userId,
      version,
      isGray: version !== null,
    };
  }

  /**
   * 批量查询用户的所有应用灰度版本（一次性查询，无需权限验证）
   */
  @Get('user-all-versions/:userId')
  @Public()
  async getUserAllVersions(
    @Param('userId') userId: string,
    @Query('appIds') appIds?: string,
  ) {
    const appIdList = appIds ? appIds.split(',').filter(Boolean) : undefined;
    const versions = await this.grayReleaseService.getUserAllGrayVersions(
      userId,
      appIdList,
    );
    return {
      userId,
      versions,
      isGray: Object.values(versions).some((v) => v !== null),
    };
  }

  /**
   * 按版本查询用户列表
   */
  @Get('version-users/:appId/:version')
  @RequirePermission(PermissionCode.SHOW_GRAY_RELEASE_LIST)
  async getUsersByVersion(
    @Param('appId') appId: string,
    @Param('version') version: string,
  ) {
    return this.grayReleaseService.getUsersByVersion(appId, version);
  }

  /**
   * 获取版本统计信息
   */
  @Get('version-stats/:appId')
  @RequirePermission(PermissionCode.SHOW_GRAY_RELEASE_LIST)
  async getVersionStats(@Param('appId') appId: string) {
    return this.grayReleaseService.getVersionStats(appId);
  }

  /**
   * 删除灰度白名单
   */
  @Delete()
  @RequirePermission(PermissionCode.DELETE_GRAY_RELEASE)
  async delete(@Body() dto: DeleteGrayReleaseDto) {
    return this.grayReleaseService.deleteGrayRelease(dto);
  }

  /**
   * 批量删除灰度白名单
   */
  @Delete('batch-delete')
  @RequirePermission(PermissionCode.BATCH_DELETE_GRAY_RELEASE)
  async batchDelete(@Body() dto: BatchDeleteGrayReleaseDto) {
    return this.grayReleaseService.batchDeleteGrayRelease(dto);
  }

  /**
   * 清理应用的所有灰度白名单
   */
  @Delete('clear/:appId')
  @RequirePermission(PermissionCode.CLEAR_APP_GRAY_RELEASE)
  async clear(@Param('appId') appId: string) {
    return this.grayReleaseService.clearAppGrayRelease(appId);
  }
}

