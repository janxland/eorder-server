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
  UsePipes,
  ValidationPipe,
  Logger,
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
import { RegisterDto } from '../auth-center/dto/register.dto';
import { User } from './user.entity';
import { Role } from '../role/role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  /**
   * 用户注册 - 公开接口，不需要认证
   */
  @Post('register')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(@Body() registerDto: RegisterDto) {
    try {
      // 检查用户名是否已存在
      const existingUser = await this.userService.findByUsername(registerDto.username);
      if (existingUser) {
        throw new CustomException(ErrorCode.ERR_11001); // 用户已存在
      }
      
      // 创建新用户
      const user = new User();
      user.username = registerDto.username;
      user.password = registerDto.password; // 直接存储密码，与现有系统保持一致
      user.enable = true;
      
      // 如果提供了邮箱，创建用户资料
      if (registerDto.email) {
        user.profile = {
          email: registerDto.email,
          nickname: registerDto.username,
          avatar: null,
          phone: null,
          address: null,
          birthday: null,
          gender: null,
          bio: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any;
      }
      
      // 查找默认角色
      const defaultRole = await this.roleRepository.findOne({
        where: { code: 'user' }
      });
      
      if (defaultRole) {
        user.roles = [defaultRole];
      }
      
      // 保存用户
      const savedUser = await this.userRepository.save(user);
      
      this.logger.log(`用户注册成功: ${registerDto.username}, ID: ${savedUser.id}`);
      
      return {
        code: 200,
        success: true,
        message: '注册成功',
        data: {
          userId: savedUser.id,
          username: savedUser.username,
        }
      };
    } catch (error) {
      this.logger.error(`注册失败: ${error.message}`);
      
      return {
        code: 400,
        success: false,
        message: error.message || '注册失败'
      };
    }
  }

  @Post()
  @UseGuards(AuthCenterGuard, PermissionCodeGuard, PreviewGuard)
  @RequirePermission(PermissionCode.CREATE_USER)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_USER_LIST)
  findAll(@Query() queryDto: GetUserDto) {
    return this.userService.findAll(queryDto);
  }

  // 获取自己的权限列表（只能获取请求人的权限）
  @Get('my-permissions')
  @UseGuards(AuthCenterGuard)
  getMyPermissions(@Request() req: any) {
    return this.userService.getUserPermissions(req.user.userId);
  }

  // 获取自己的角色权限树（只能获取请求人的权限）
  @Get('my-role-permissions')
  @UseGuards(AuthCenterGuard)
  getMyRolePermissions(@Request() req: any) {
    return this.userService.getUserRolePermissions(req.user.userId);
  }

  // 获取自己的profile（不需要权限CODE）
  @Get('my-profile')
  @UseGuards(AuthCenterGuard)
  getMyProfile(@Request() req: any) {
    const currentUser = req.user;
    return this.userService.findUserProfile(currentUser.userId);
  }

  @Get(':id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_USER_DETAIL)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.UPDATE_USER)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.DELETE_USER)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Patch('password/:id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.UPDATE_USER_PASSWORD)
  updatePassword(@Param('id', ParseIntPipe) id: number, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.userService.updatePassword(id, updatePasswordDto);
  }

  @Post('roles/:id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.ASSIGN_USER_ROLES)
  addRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.addRoles(id, addUserRolesDto.roleIds);
  }

  @Delete('roles/:id')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.REMOVE_USER_ROLES)
  removeRoles(@Param('id', ParseIntPipe) id: number, @Body() addUserRolesDto: AddUserRolesDto) {
    return this.userService.removeRoles(id, addUserRolesDto.roleIds);
  }

  @Get('username/:username')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_USER_DETAIL)
  findByUsername(@Param('username') username: string) {
    return this.userService.findByUsername(username);
  }

  // 查询用户的profile（需要权限CODE）
  @Get('profile/:userId')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
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
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
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
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_USER_PERMISSIONS)
  getUserPermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserPermissions(userId);
  }

  // 新增：获取用户角色权限树
  @Get('role-permissions/:userId')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.SHOW_USER_ROLE_PERMISSIONS)
  getUserRolePermissions(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getUserRolePermissions(userId);
  }

  // 新增：更新用户权限
  @Put('permissions/:userId')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  @RequirePermission(PermissionCode.UPDATE_USER_PERMISSIONS)
  updateUserPermissions(@Param('userId', ParseIntPipe) userId: number, @Body() permissions: { permissionIds: number[] }) {
    return this.userService.updateUserPermissions(userId, permissions.permissionIds);
  }
}