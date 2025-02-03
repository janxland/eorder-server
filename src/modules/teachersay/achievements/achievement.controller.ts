// src/achievements/achievement.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { Achievement, AchievementStatus } from './achievement.entity';
import { CreateAchievementDto, GetAchievementDto } from './dto';

@Controller('achievement')
export class AchievementController {
    constructor(private readonly achievementService: AchievementService) {}
    /**
     * 审核成果
     * @param id 成果ID
     * @param status 新的审核状态
     * @returns 审核后的成果
     */
    @Patch('/audit/:id')
    async auditAchievement(
        @Param('id') id: number,
        @Body('status') status: AchievementStatus,
    ) {
        return this.achievementService.auditAchievement(id, status);
    }

    @Get()
    getAll(@Query() queryDto: GetAchievementDto) {
        return this.achievementService.findAll(queryDto);
    }

    @Get(':id')
    getOne(@Param('id') id: number): Promise<Achievement> {
        return this.achievementService.findOne(id);
    }

    @Post()
    create(@Body() achievementData: CreateAchievementDto): Promise<Achievement> {
        return this.achievementService.create(achievementData);
    }

    @Patch(':id')
    update(@Param('id') id: number, @Body() achievementData: Partial<Achievement>): Promise<Achievement> {
        return this.achievementService.update(id, achievementData);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.achievementService.remove(id);
    }
}
