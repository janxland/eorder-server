import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { StorageAccountService } from './storage-account.service';
import { CreateStorageAccountDto, UpdateStorageAccountDto } from './dto/storage-account.dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

/**
 * 云存储账号管理（密钥零明文）
 * 权限：复用现有 STORAGE_CONFIG 权限码体系
 */
@Controller('cloud-storage/accounts')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class StorageAccountController {
  constructor(private readonly accountService: StorageAccountService) {}

  @Get()
  @RequirePermission(PermissionCode.SHOW_STORAGE_CONFIG_LIST)
  async findAll() {
    const accounts = await this.accountService.findAll();
    // 列表也解密出掩码（确认账号已配置密钥）；明文仅详情 + SUPER_ADMIN 可见
    const safeList = await Promise.all(
      accounts.map(async (a) => {
        const creds = await this.accountService.getCredentials(a.id).catch(() => null);
        return this.accountService.toSafe(a, creds?.accessKey || '', creds?.secretKey || '', false);
      }),
    );
    return { success: true, data: safeList };
  }

  @Get(':id')
  @RequirePermission(PermissionCode.SHOW_STORAGE_CONFIG_DETAIL)
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const account = await this.accountService.findById(id);
    const creds = await this.accountService.getCredentials(id).catch(() => null);
    const ak = creds?.accessKey || '';
    const sk = creds?.secretKey || '';
    // 仅 SUPER_ADMIN 详情可见明文（忘记密钥时查询用）
    const isSuperAdmin = (req.user?.roleCodes || []).includes('SUPER_ADMIN');
    return {
      success: true,
      data: this.accountService.toSafe(account, ak, sk, isSuperAdmin),
    };
  }

  @Post()
  @RequirePermission(PermissionCode.CREATE_STORAGE_CONFIG)
  async create(@Body() dto: CreateStorageAccountDto) {
    const account = await this.accountService.create(dto);
    return { success: true, data: account };
  }

  @Put(':id')
  @RequirePermission(PermissionCode.UPDATE_STORAGE_CONFIG)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStorageAccountDto) {
    const account = await this.accountService.update(id, dto);
    return { success: true, data: account };
  }

  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_STORAGE_CONFIG)
  async remove(@Param('id', ParseIntPipe) id: number) {
    const ok = await this.accountService.remove(id);
    return { success: ok };
  }
}
