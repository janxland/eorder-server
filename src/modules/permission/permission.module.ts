/**
 * website: https://www.roginx.ink
 */

import { forwardRef, Global, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './permission.entity';
import { Role } from '@/modules/role/role.entity';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';
import { PermissionCacheService } from './permission-cache.service';
import { SharedModule } from '@/shared/shared.module';
import { RoleModule } from '@/modules/role/role.module';

@Global() // 标记为全局模块，使 PermissionCacheService 在所有模块中可用
@Module({
  imports: [
    TypeOrmModule.forFeature([Permission, Role]),
    forwardRef(() => AuthCenterModule),
    SharedModule, // 包含 RedisService
    forwardRef(() => RoleModule), // 包含 RoleService
  ],
  controllers: [PermissionController],
  providers: [PermissionService, PermissionCacheService],
  exports: [PermissionService, PermissionCacheService]
})
export class PermissionModule {}
