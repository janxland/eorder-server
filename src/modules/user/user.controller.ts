import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Delete,
  Patch,
  Put,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  AddUserRolesDto,
  CreateUserDto,
  GetUserDto,
  UpdatePasswordDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto';
import { CustomException, ErrorCode } from '@/common/exceptions/custom.exception';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PreviewGuard } from '@/common/guards';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('user')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(PreviewGuard)
  @RequirePermission(PermissionCode.CREATE_USER)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @RequirePermission(PermissionCode.SHOW_USER_LIST)
  findAll(@Query() queryDto: GetUserDto) {
    return this.userService.findAll(queryDto);
  }

  // 获取自己的权限列表（只能获取请求人的权限）
  @Get('my-permissions')
  getMyPermissions(@Request() req: any) {
    return this.userService.getUserPermissions(req.user.userId);
  }

  // 获取自己的角色权限树（只能获取请求人的权限）
  @Get('my-role-permissions')
  getMyRolePermissions(@Request() req: any) {
    return this.userService.getUserRolePermissions(req.user.userId);
  }

  // 获取自己的profile（不需要权限CODE）
  @Get('my-profile')
  getMyProfile(@Request() req: any) {
    const currentUser = req.user;
    return this.userService.findUserProfile(currentUser.userId);
  }

  @Get(':id')
  @RequirePermission(PermissionCode.SHOW_USER_DETAIL)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PermissionCode.UPDATE_USER)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_USER)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Patch('password/:id')
  @RequirePermission(PermissionCode.UPDATE_USER_PASSWORD)
  updatePassword(@Param('id', ParseIntPipe) id: number, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.userService.updatePassword(id, updatePasswordDto);
  }

  @Post('roles/:id')
  @RequirePermission(PermissionCode.ASSIGN_USER_ROLES)
  addRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.addRoles(id, addUserRolesDto.roleIds);
  }

  @Delete('roles/:id')
  @RequirePermission(PermissionCode.REMOVE_USER_ROLES)
  removeRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.removeRoles(id, addUserRolesDto.roleIds);
  }

  @Get('username/:username')
  @RequirePermission(PermissionCode.SHOW_USER_DETAIL)
  findByUsername(@Param('username') username: string) {
    return this.userService.findByUsername(username);
  }

  // 查询用户的profile（需要权限CODE）
  @Get('profile/:userId')
  @RequirePermission(PermissionCode.SHOW_USER_PROFILE)
  getUserProfile(@Param('userId') userId: number, @Request() req: any) {
    // 涉及隐私信息，只能本人或者超管查询
    const currentUser = req.user;
    // 只能本人或者超管查询
    if (currentUser.userId === userId || currentUser.roleCodes.includes('SUPER_ADMIN')) {
      return this.userService.findUserProfile(userId);
    }
    throw new CustomException(ErrorCode.ERR_11003);
  }

  // 更新用户的profile - PATCH方法
  @Patch('profile/:userId')
  @RequirePermission(PermissionCode.UPDATE_USER_PROFILE)
  updateUserProfile(@Param('userId') userId: number, @Body() updateProfileDto: UpdateProfileDto, @Request() req: any) {
    const currentUser = req.user;
    // 只能本人或者超管更新
    if (currentUser.userId === userId || currentUser.roleCodes.includes('SUPER_ADMIN')) {
      return this.userService.updateUserProfile(userId, updateProfileDto);
    }
    throw new CustomException(ErrorCode.ERR_11003);
  }

  // 新增：获取用户权限列表
  @Get('permissions/:userId')
  @RequirePermission(PermissionCode.SHOW_USER_PERMISSIONS)
  getUserPermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserPermissions(userId);
  }

  // 新增：获取用户角色权限树
  @Get('role-permissions/:userId')
  @RequirePermission(PermissionCode.SHOW_USER_ROLE_PERMISSIONS)
  getUserRolePermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserRolePermissions(userId);
  }

  // 新增：更新用户权限
  @Put('permissions/:userId')
  @RequirePermission(PermissionCode.UPDATE_USER_PERMISSIONS)
  updateUserPermissions(@Param('userId', ParseIntPipe) userId: number, @Body() permissions: { permissionIds: number[] }) {
    return this.userService.updateUserPermissions(userId, permissions.permissionIds);
  }
}