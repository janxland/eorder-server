// src/users/user.module.ts

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Teacher } from './teacher.entity';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { Role } from '@/modules/role/role.entity';
import { User } from '@/modules/user/user.entity';
import { UserService } from '@/modules/user/user.service';
import { Profile } from '@/modules/user/profile.entity';
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Teacher, User ,Role,Profile])],
    providers: [TeacherService, UserService],
    controllers: [TeacherController],
    exports: [TeacherService],
})
export class TeacherModule {}
