/**********************************
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/07 20:30:08
 * @Email: zclzone@outlook.com
 * Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 **********************************/

import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/user/user.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleModule } from './modules/role/role.module';
import { AuthCenterModule } from './modules/auth-center/auth-center.module';

import { TeacherModule } from './modules/teachersay/teachers/teacher.module';
import { AchievementTypeModule  } from './modules/teachersay/achievement-types/achievement-type.module';
import { AchievementModule} from './modules/teachersay/achievements/achievement.module';
import { OrderModule } from './modules/order/order.module';
import { ePayModule } from './modules/epay/epay.module';
import { ProductsModule } from './modules/product/products.module';
import { SystemModule } from './modules/system/system.module';
import { KeyValueModule } from './modules/jsonmap/key-value.module';
import { CloudStorageModule } from './modules/cloud-storage/cloud-storage.module';
import { AIModelModule } from './modules/ai-model/ai-model.module';

@Module({
  imports: [
    /* 配置文件模块 */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    UserModule,
    PermissionModule,
    RoleModule,
    SharedModule,
    AuthCenterModule,
    KeyValueModule,
    TeacherModule,
    SystemModule,
    AchievementTypeModule,
    AchievementModule,
    OrderModule,
    ePayModule,
    ProductsModule,
    CloudStorageModule,
    AIModelModule
  ],
})
export class AppModule {}
