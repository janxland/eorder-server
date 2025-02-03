// src/achievement-types/achievement-type.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AchievementTypeService } from './achievement-type.service';
import { AchievementType } from './achievement-type.entity';
import { GetTypeDto } from './dto';

@Controller('achievement-types')
export class AchievementTypeController {
    constructor(private readonly achievementTypeService: AchievementTypeService) {}

    @Get()
    getAll(@Query() queryDto: GetTypeDto){
        return this.achievementTypeService.findAll(queryDto);
    }

    @Get(':id')
    getOne(@Param('id') id: number): Promise<AchievementType> {
        return this.achievementTypeService.findOne(id);
    }

    @Post()
    create(@Body() typeData: Partial<AchievementType>): Promise<AchievementType> {
        return this.achievementTypeService.create(typeData);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() typeData: Partial<AchievementType>): Promise<AchievementType> {
        return this.achievementTypeService.update(id, typeData);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.achievementTypeService.remove(id);
    }
}
