// src/achievements/achievement.module.ts

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './achievement.entity';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { AchievementType } from '../achievement-types/achievement-type.entity';
import { User } from '../../user/user.entity';
import { Teacher } from '../teachers/teacher.entity';
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Achievement, AchievementType, User,Teacher])],
    providers: [AchievementService],
    controllers: [AchievementController],
    exports: [AchievementService],
})
export class AchievementModule {}
