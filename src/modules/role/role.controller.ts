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
  Request,
} from '@nestjs/common';
import { RoleService } from './role.service';
import {
  AddRolePermissionsDto,
  AddRoleUsersDto,
  CreateRoleDto,
  GetRolesDto,
  QueryRoleDto,
  UpdateRoleDto,
} from './dto';
import { PreviewGuard } from '@/common/guards';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('role')
@UseGuards(AuthCenterGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  findAll(@Query() query: GetRolesDto) {
    return this.roleService.findAll(query);
  }

  @Get('page')
  @Roles('SUPER_ADMIN')
  findPagination(@Query() queryDto: QueryRoleDto) {
    return this.roleService.findPagination(queryDto);
  }

  @Get('permissions')
  @Roles('SUPER_ADMIN')
  findRolePermissions(@Query('id') id: number) {
    return this.roleService.findRolePermissions(+id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN', 'SYS_ADMIN', 'ROLE_PMS')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: number) {
    return this.roleService.remove(+id);
  }

  @Post('permissions/add')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  addRolePermissions(@Body() dto: AddRolePermissionsDto) {
    return this.roleService.addRolePermissions(dto);
  }

  @Get('permissions/tree')
  @UseGuards(PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_ROLE_PERMISSIONS_TREE)
  // 允许所有已登录用户获取自己角色的权限树
  findRolePermissionsTree(@Request() req: any) {
    return this.roleService.findRolePermissionsTree(req.user.currentRoleCode);
  }

  // 给角色分配用户
  @Patch('users/add/:roleId')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  addRoleUsers(@Param('roleId') roleId: string, @Body() dto: AddRoleUsersDto) {
    return this.roleService.addRoleUsers(+roleId, dto);
  }

  // 给角色取消分配用户
  @Patch('users/remove/:roleId')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  removeRoleUsers(@Param('roleId') roleId: string, @Body() dto: AddRoleUsersDto) {
    return this.roleService.removeRoleUsers(+roleId, dto);
  }
}
