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
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('user')
@UseGuards(AuthCenterGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  findAll(@Query() queryDto: GetUserDto) {
    return this.userService.findAll(queryDto);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Patch('password/:id')
  @Roles('SUPER_ADMIN')
  updatePassword(@Param('id', ParseIntPipe) id: number, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.userService.updatePassword(id, updatePasswordDto);
  }

  @Post('roles/:id')
  @Roles('SUPER_ADMIN')
  addRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.addRoles(id, addUserRolesDto.roleIds);
  }

  @Delete('roles/:id')
  @Roles('SUPER_ADMIN')
  removeRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.removeRoles(id, addUserRolesDto.roleIds);
  }

  @Get('username/:username')
  @Roles('SUPER_ADMIN')
  findByUsername(@Param('username') username: string) {
    return this.userService.findByUsername(username);
  }

  // 查询用户的profile
  @Get('profile/:userId')
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
  @Roles('SUPER_ADMIN')
  getUserPermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserPermissions(userId);
  }

  // 新增：获取用户角色权限树
  @Get('role-permissions/:userId')
  @Roles('SUPER_ADMIN')
  getUserRolePermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserRolePermissions(userId);
  }

  // 新增：更新用户权限
  @Put('permissions/:userId')
  @Roles('SUPER_ADMIN')
  updateUserPermissions(@Param('userId', ParseIntPipe) userId: number, @Body() permissions: { permissionIds: number[] }) {
    return this.userService.updateUserPermissions(userId, permissions.permissionIds);
  }
}