// src/achievement-types/achievement-type.module.ts

import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementType } from './achievement-type.entity';
import { AchievementTypeService } from './achievement-type.service';
import { AchievementTypeController } from './achievement-type.controller';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([AchievementType]),
        forwardRef(() => AuthCenterModule)
    ],
    providers: [AchievementTypeService],
    controllers: [AchievementTypeController],
    exports: [AchievementTypeService],
})
export class AchievementTypeModule {}
