/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/07 20:26:22
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

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
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import { PreviewGuard } from '@/common/guards';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@UseGuards(AuthCenterGuard)
@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Post('batch')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  batchCreate(@Body() createPermissionDtos: CreatePermissionDto[]) {
    return this.permissionService.batchCreate(createPermissionDtos);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  findAll() {
    return this.permissionService.findAll();
  }

  @Get('tree')
  @Roles('SUPER_ADMIN')
  findAllTree() {
    return this.permissionService.findAllTree();
  }

  @Get('menu/tree')
  findMenuTree() {
    return this.permissionService.findMenuTree();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() updatePermissionDto: UpdatePermissionDto) {
    return this.permissionService.update(+id, updatePermissionDto);
  }

  @Delete(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.permissionService.remove(+id);
  }

  @Get('button/:parentId')
  @Roles('SUPER_ADMIN')
  findButton(@Param('parentId') parentId: string) {
    return this.permissionService.findButton(+parentId);
  }

  /* 校验 path 存不存在menu资源内  */
  @Get('menu/validate')
  @Roles('SUPER_ADMIN')
  validateMenuPath(@Query('path') path: string) {
    return this.permissionService.validateMenuPath(path);
  }

  /* 修复所有空 type 的权限 */
  @Post('fix-empty-types')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  fixEmptyTypes() {
    return this.permissionService.fixEmptyTypes();
  }
}
