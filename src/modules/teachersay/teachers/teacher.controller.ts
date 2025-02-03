// src/users/user.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { Teacher as User } from './teacher.entity';
import { GetUserDto, updateTeacherDto } from './dto';

@Controller('tuser')
export class TeacherController {
    constructor(private readonly userService: TeacherService) {}

    @Get('/quick')
    quickSeach(@Query() queryDto: GetUserDto){
        return this.userService.quickSeach(queryDto);
    }
    @Get()
    getAll(@Query() queryDto: GetUserDto){
        return this.userService.findAll(queryDto);
    }

    @Get(':id')
    getOne(@Param('id') id) {
        console.log(id);
        return this.userService.findOne(id);
    }

    @Post()
    create(@Body() userData){
        return this.userService.create(userData);
    }

    @Patch(':id')
    update(@Param('id') id: number, @Body() user: updateTeacherDto) {
        return this.userService.update(id, user);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.userService.remove(id);
    }
}
