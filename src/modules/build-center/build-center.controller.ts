/**
 * 构建中心控制器
 * website: https://www.roginx.ink
 */

import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Request } from 'express';
import { BuildCenterService } from './build-center.service';
import { TriggerBuildDto, PromoteDto, RollbackDto, QueryBuildsDto } from './dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('build-center')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class BuildCenterController {
  constructor(private readonly buildCenterService: BuildCenterService) {}

  private triggeredBy(req: Request): string {
    const user: any = (req as any).user;
    return user?.username ? String(user.username) : user?.userId != null ? String(user.userId) : 'unknown';
  }

  /**
   * 触发构建（派发 GitHub Actions，账本落 started）
   */
  @Post('trigger')
  @RequirePermission(PermissionCode.TRIGGER_BUILD_CENTER_BUILD)
  async trigger(@Body() dto: TriggerBuildDto, @Req() req: Request) {
    return this.buildCenterService.trigger(dto, this.triggeredBy(req));
  }

  /**
   * 同步构建终态（拉取 Actions run 结论收敛账本 + 回填版本指针）
   */
  @Post('sync/:id')
  @RequirePermission(PermissionCode.SYNC_BUILD_CENTER)
  async sync(@Param('id', ParseIntPipe) id: number) {
    return this.buildCenterService.sync(id);
  }

  /**
   * promote：灰度版本转全量（copyObject 切生产指针）
   */
  @Post('promote')
  @RequirePermission(PermissionCode.PROMOTE_BUILD_CENTER)
  async promote(@Body() dto: PromoteDto, @Req() req: Request) {
    return this.buildCenterService.promote(dto, this.triggeredBy(req));
  }

  /**
   * rollback：生产回滚到指定旧版本（机制同 promote，账本记 rollback）
   */
  @Post('rollback')
  @RequirePermission(PermissionCode.ROLLBACK_BUILD_CENTER)
  async rollback(@Body() dto: RollbackDto, @Req() req: Request) {
    return this.buildCenterService.rollback(dto, this.triggeredBy(req));
  }

  /**
   * 发版账本列表（分页）
   */
  @Get('builds')
  @RequirePermission(PermissionCode.SHOW_BUILD_CENTER_LIST)
  async builds(@Query() query: QueryBuildsDto) {
    return this.buildCenterService.listBuilds(query);
  }

  /**
   * 账本单条详情
   */
  @Get('builds/:id')
  @RequirePermission(PermissionCode.SHOW_BUILD_CENTER_LIST)
  async build(@Param('id', ParseIntPipe) id: number) {
    return this.buildCenterService.getBuild(id);
  }

  /**
   * 可回滚版本清单（该应用构建成功的去重版本，新→旧）
   */
  @Get('versions/:appId')
  @RequirePermission(PermissionCode.SHOW_BUILD_CENTER_LIST)
  async versions(@Param('appId') appId: string) {
    return this.buildCenterService.listVersions(appId);
  }

  /**
   * 全应用概览：生产指针 + 最近构建 + 灰度绑定人数
   */
  @Get('status')
  @RequirePermission(PermissionCode.SHOW_BUILD_CENTER_LIST)
  async status() {
    return this.buildCenterService.status();
  }
}
