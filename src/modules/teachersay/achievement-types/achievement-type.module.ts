// src/achievement-types/achievement-type.module.ts

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementType } from './achievement-type.entity';
import { AchievementTypeService } from './achievement-type.service';
import { AchievementTypeController } from './achievement-type.controller';
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([AchievementType])],
    providers: [AchievementTypeService],
    controllers: [AchievementTypeController],
    exports: [AchievementTypeService],
})
export class AchievementTypeModule {}
