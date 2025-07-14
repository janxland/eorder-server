// src/achievements/achievement.module.ts

import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './achievement.entity';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { AchievementType } from '../achievement-types/achievement-type.entity';
import { User } from '../../user/user.entity';
import { Teacher } from '../teachers/teacher.entity';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([Achievement, AchievementType, User, Teacher]),
        forwardRef(() => AuthCenterModule)
    ],
    providers: [AchievementService],
    controllers: [AchievementController],
    exports: [AchievementService],
})
export class AchievementModule {}
