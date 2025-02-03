// src/users/user.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Teacher } from './teacher.entity';
import { CreateUserDto, GetUserDto, Profile, updateTeacherDto } from './dto';
import { User } from '../../user/user.entity';
import { UserService } from '@/modules/user/user.service';
@Injectable()
export class TeacherService {
  constructor(
    private readonly userService: UserService, // 注入 UserService
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}
  async quickSeach(query: GetUserDto) {
    const [teachers, total] = await this.teacherRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.profile', 'profile')
      .loadRelationCountAndMap('teacher.achievementCount', 'teacher.achievements')
      .where('teacher.name LIKE :name', { name: `%${query.username || ''}%` })
      .orderBy('teacher.createTime', 'ASC')
      .getManyAndCount();

    const pageData = teachers.map((item) => {
      let newItem = {
        id: item.user.id,
        name: item.name,
      }
      return {
        ...newItem
      };
    });

    return { pageData, total };
  }
  async findAll(query: GetUserDto) {
    const pageSize = query.pageSize || 10;
    const pageNo = query.pageNo || 1;

    const [teachers, total] = await this.teacherRepository
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.profile', 'profile')
      .loadRelationCountAndMap('teacher.achievementCount', 'teacher.achievements')
      .where('teacher.name LIKE :name', { name: `%${query.username || ''}%` })
      // 如果需要按启用状态过滤，可以取消注释并调整
      // .andWhere('teacher.enable = :enable', { enable: query.enable })
      .orderBy('teacher.createTime', 'ASC')
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const pageData = teachers.map((item) => {
      return {
        ...item,
        ...item.user.profile,
        achievementCount: item['achievementCount'],
      };
    });

    return { pageData, total };
  }
  findOne(id: number): Promise<User> {
    console.log(id);
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async create(userData: CreateUserDto): Promise<boolean> {
    console.log(userData);
    
    // 获取 QueryRunner
    const queryRunner = this.teacherRepository.manager.connection.createQueryRunner();

    // 连接并启动事务
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 使用事务管理器创建 User
      const createdUser: User = await this.userService.createOne(userData, queryRunner.manager);

      // 创建 Teacher 实例，并设置共享主键
      const teacher = new Teacher();
      teacher.id = createdUser.id; // 共享主键
      teacher.name = userData.username; // 假设 userData 包含 profile 信息
      teacher.user = createdUser;

      // 保存 Teacher
      await queryRunner.manager.save(Teacher, teacher);

      // 提交事务
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      // 回滚事务
      await queryRunner.rollbackTransaction();
      console.error('创建 Teacher 失败:', error);
      throw error; // 或者根据需求返回 false
    } finally {
      // 释放 QueryRunner
      await queryRunner.release();
    }
  }

  async update(id: number, userData:updateTeacherDto ): Promise<User> {
    console.log(userData);
    
    await this.teacherRepository.update(id, userData);
    await this.userService.update(id, userData.user);

    await this.userService.updateProfile(id, userData.user.profile);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findByUsername(username: string) {
    return this.usersRepository.findOne({
      where: { username },
      select: ['id', 'username', 'password', 'enable'],
      relations: {
        profile: true,
        roles: true,
      },
    });
  }
}

function In(roleIds: number[]): number | import('typeorm').FindOperator<number> {
  throw new Error('Function not implemented.');
}
function hashSync(password: string): string {
  throw new Error('Function not implemented.');
}
