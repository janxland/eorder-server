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
  addUser(@Body() user: CreateUserDto) {
    return this.userService.create(user);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  getAllUsers(@Query() queryDto: GetUserDto) {
    return this.userService.findAll(queryDto);
  }

  @Post(':id/password')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  updatePwd(@Param('id') id: number, @Body() dto: UpdatePasswordDto) {
    return this.userService.resetPassword(id, dto.password);
  }

  @Patch(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  updateUser(@Param('id') id: number, @Body() user: UpdateUserDto) {
    return this.userService.update(id, user);
  }

  @Delete(':id')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: number) {
    return this.userService.findUserProfile(id);
  }

  @Post(':id/roles')
  @UseGuards(PreviewGuard)
  @Roles('SUPER_ADMIN')
  addUserRoles(@Param('id') id: number, @Body() dto: AddUserRolesDto) {
    return this.userService.addRoles(id, dto.roleIds);
  }

  /**
   * @desc 获取当前登录用户的详情信息
   */
  @Get('detail')
  getUserInfo(@Request() req: any) {
    const currentUser = req.user;
    return this.userService.findUserDetail(currentUser.userId, currentUser.currentRoleCode);
  }

  @Get('user/:username')
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
  updateUserProfilePatch(@Param('userId') userId: number, @Body() profileDto: UpdateProfileDto, @Request() req: any) {
    // 涉及隐私信息，只能本人或者超管更新
    const currentUser = req.user;
    // 只能本人或者超管更新
    if (currentUser.userId === userId || currentUser.roleCodes.includes('SUPER_ADMIN')) {
      return this.userService.updateProfile(userId, profileDto);
    }
    throw new CustomException(ErrorCode.ERR_11003);
  }

  // 更新用户的profile - PUT方法
  @Put('profile/:userId')
  updateUserProfilePut(@Param('userId') userId: number, @Body() profileDto: UpdateProfileDto, @Request() req: any) {
    // 涉及隐私信息，只能本人或者超管更新
    const currentUser = req.user;
    // 只能本人或者超管更新
    if (currentUser.userId === userId || currentUser.roleCodes.includes('SUPER_ADMIN')) {
      return this.userService.updateProfile(userId, profileDto);
    }
    throw new CustomException(ErrorCode.ERR_11003);
  }
}
