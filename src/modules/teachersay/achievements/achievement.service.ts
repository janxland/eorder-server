import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Achievement, AchievementStatus } from './achievement.entity';
import { AchievementType } from '../achievement-types/achievement-type.entity';
import { User } from '../../user/user.entity';
import { CreateAchievementDto } from './dto';
import { Teacher } from '../teachers/teacher.entity';

@Injectable()
export class AchievementService {
    constructor(
        @InjectRepository(Achievement)
        private achievementsRepository: Repository<Achievement>,
        @InjectRepository(AchievementType)
        private achievementTypesRepository: Repository<AchievementType>,
        @InjectRepository(Teacher)
        private teacherRepository: Repository<Teacher>,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) {}

    async findAll(query) {
        const pageSize = parseInt(query.pageSize, 10) || 10;
        const pageNo = parseInt(query.pageNo, 10) || 1;
        const where: any = {};
    
        if (query.title) {
            where.title = Like(`%${query.title}%`);
        }
    
        if (query.typeId) {
            where.type = { id: query.typeId };
        }
    
        if (query.responsibleUserId) {
            where.responsibleUser = { id: query.responsibleUserId };
        }
    
        if (query.authorIds && query.authorIds.length > 0) {
            where.authors = { id: In(query.authorIds) };
        }
        if (query.authorId) {
            where.authors = { id: query.authorId };
        }
        if (query.status) {
            where.status = query.status;
        }
    
        const [achievements, total] = await this.achievementsRepository.findAndCount({
            take: pageSize,
            skip: (pageNo - 1) * pageSize,
            relations: ['type', 'authors', 'responsibleUser'],
            where: where,
            order: {
                createdAt: 'DESC', // 可根据需要调整排序方式
            },
        });
    
        const pageData = achievements.map((item) => ({
            id: item.id,
            achievementCode: item.achievementCode,
            title: item.title,
            description: item.description,
            type: item.type ? item.type.name : null, // 获取类型名称
            authors: item.authors ? item.authors.map(author => author.name) : [], // 获取作者姓名列表
            publishedDate: item.publishedDate,
            status: item.status,
            level: item.level,
            department: item.department,
            keywords: item.keywords,
            citationCount: item.citationCount,
            link: item.link,
            fundingAmount: item.fundingAmount,
            completionDate: item.completionDate,
            attachments: item.attachments,
            responsibleUserName: item.responsibleUser ? item.responsibleUser.name : null, // 获取负责人姓名
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        }));
    
        return { pageData, total };
    }

    findOne(id: number): Promise<Achievement> {
        return this.achievementsRepository.findOne({ where: { id }, relations: ['type', 'authors'] });
    }
    async auditAchievement(id: number, status: AchievementStatus): Promise<Achievement> {
        const achievement = await this.achievementsRepository.findOne({ where: { id } });
    
        if (!achievement) {
          throw new NotFoundException('Achievement not found');
        }
    
        // 更新审核状态
        achievement.status = status;
        
        // 保存更新后的成果
        return await this.achievementsRepository.save(achievement);
      }
    async create(createAchievementDto: CreateAchievementDto): Promise<Achievement> {
        const queryRunner = this.achievementTypesRepository.manager.connection.createQueryRunner();

        // 建立数据库连接
        await queryRunner.connect();

        // 开始事务
        await queryRunner.startTransaction();

        try {
            const achievement = new Achievement();
            console.log(createAchievementDto);
            
            // 赋值基本字段
            achievement.title = createAchievementDto.title;
            achievement.description = createAchievementDto.description || "简介";
            achievement.status = createAchievementDto.status || AchievementStatus.PENDING;
            achievement.level = createAchievementDto.level;
            achievement.department = createAchievementDto.department;
            achievement.keywords = createAchievementDto.keywords;
            achievement.citationCount = createAchievementDto.citationCount;
            achievement.link = createAchievementDto.link;
            achievement.fundingAmount = createAchievementDto.fundingAmount;
            achievement.attachments = createAchievementDto.attachments;

            // 处理 publishedDate 和 completionDate
            achievement.publishedDate = createAchievementDto.publishedDate 
                ? new Date(createAchievementDto.publishedDate) 
                : null;
            achievement.completionDate = createAchievementDto.completionDate 
                ? new Date(createAchievementDto.completionDate) 
                : null;

            // 处理 AchievementType 关联
            if (createAchievementDto.typeId) {
                const type = await queryRunner.manager.findOne(AchievementType, {
                    where: { id: createAchievementDto.typeId },
                });
                if (!type) {
                    throw new NotFoundException(`AchievementType with ID ${createAchievementDto.typeId} not found`);
                }
                achievement.type = type;
            }

            // 处理 authors 关联
            if (createAchievementDto.authorIds && createAchievementDto.authorIds.length > 0) {
                const authors = await queryRunner.manager.findByIds(Teacher, createAchievementDto.authorIds);
                if (authors.length !== createAchievementDto.authorIds.length) {
                    throw new NotFoundException('One or more authors not found');
                }
                achievement.authors = authors;
            }

            // 处理 responsibleUser 关联
            if (createAchievementDto.responsibleUserId) {
                const responsibleUser = await queryRunner.manager.findOne(Teacher, {
                    where: { id: createAchievementDto.responsibleUserId },
                });
                if (!responsibleUser) {
                    throw new NotFoundException(`ResponsibleUser (Teacher) with ID ${createAchievementDto.responsibleUserId} not found`);
                }
                achievement.responsibleUser = responsibleUser;
            }

            // 保存 Achievement
            const savedAchievement = await queryRunner.manager.save(Achievement, achievement);

            // 提交事务
            await queryRunner.commitTransaction();

            return savedAchievement;
        } catch (error) {
            // 回滚事务
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            // 释放 QueryRunner
            await queryRunner.release();
        }
    }

    async update(id: number, achievementData: Partial<Achievement>): Promise<Achievement> {
        await this.achievementsRepository.update(id, achievementData);
        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.achievementsRepository.delete(id);
    }
}