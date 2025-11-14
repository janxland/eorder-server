/**
 * website: https://www.roginx.ink
 */

import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/user/user.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleModule } from './modules/role/role.module';
import { AuthCenterModule } from './modules/auth-center/auth-center.module';

import { OrderModule } from './modules/order/order.module';
import { ePayModule } from './modules/epay/epay.module';
import { ProductsModule } from './modules/product/products.module';
import { SystemModule } from './modules/system/system.module';
import { KeyValueModule } from './modules/jsonmap/key-value.module';
import { CloudStorageModule } from './modules/cloud-storage/cloud-storage.module';
import { AIModelModule } from './modules/ai-model/ai-model.module';
import { LLMModule } from './modules/llm/llm.module';
import { GrayReleaseModule } from './modules/gray-release/gray-release.module';

@Module({
  imports: [
    /* 配置文件模块 */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    SharedModule, // 必须在前面，提供 RedisService
    UserModule,
    PermissionModule, // 提供 PermissionCacheService
    RoleModule,
    AuthCenterModule,
    KeyValueModule,
    SystemModule,
    OrderModule,
    ePayModule,
    ProductsModule,
    CloudStorageModule,
    AIModelModule,
    LLMModule,
    GrayReleaseModule,
  ],
})
export class AppModule {}
