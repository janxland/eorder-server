/**
 * website: https://www.roginx.ink
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto, UpdatePermissionDto, GetPermissionDto } from './dto';
import { PreviewGuard } from '@/common/guards';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';

@UseGuards(AuthCenterGuard)
@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @UseGuards(PreviewGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.CREATE_PERMISSION)
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Post('batch')
  @UseGuards(PreviewGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.BATCH_CREATE_PERMISSION)
  batchCreate(@Body() createPermissionDtos: CreatePermissionDto[]) {
    return this.permissionService.batchCreate(createPermissionDtos);
  }

  @Get()
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_PERMISSION_LIST)
  findAll(@Query() queryDto: GetPermissionDto) {
    return this.permissionService.findAll(queryDto);
  }

  @Get('tree')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_PERMISSION_TREE)
  findAllTree() {
    return this.permissionService.findAllTree();
  }

  @Get('menu/tree')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_PERMISSION_MENU_TREE)
  findMenuTree() {
    return this.permissionService.findMenuTree();
  }

  @Get(':id')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_PERMISSION_DETAIL)
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(PreviewGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.UPDATE_PERMISSION)
  update(@Param('id') id: string, @Body() updatePermissionDto: UpdatePermissionDto) {
    return this.permissionService.update(+id, updatePermissionDto);
  }

  @Delete(':id')
  @UseGuards(PreviewGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.DELETE_PERMISSION)
  remove(@Param('id') id: string) {
    return this.permissionService.remove(+id);
  }

  @Get('button/:parentId')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_PERMISSION_BUTTON)
  findButton(@Param('parentId') parentId: string) {
    return this.permissionService.findButton(+parentId);
  }

  /* 校验 path 存不存在menu资源内  */
  @Get('menu/validate')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.VALIDATE_MENU_PATH)
  validateMenuPath(@Query('path') path: string) {
    return this.permissionService.validateMenuPath(path);
  }

  /* 修复所有空 type 的权限 */
  @Post('fix-empty-types')
  @UseGuards(PreviewGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.FIX_EMPTY_TYPES)
  fixEmptyTypes() {
    return this.permissionService.fixEmptyTypes();
  }
}
