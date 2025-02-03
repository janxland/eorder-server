// src/achievement-types/achievement-type.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AchievementType } from './achievement-type.entity';

@Injectable()
export class AchievementTypeService {
    constructor(
        @InjectRepository(AchievementType)
        private achievementTypesRepository: Repository<AchievementType>,
    ) {}

    async findAll(query) {
        const pageSize = query.pageSize || 10;
        const pageNo = query.pageNo || 1;
        const [users, total] = await this.achievementTypesRepository.findAndCount({
            take: pageSize,
            skip: (pageNo - 1) * pageSize,
            where: {
                name: Like(`%${query.name || ''}%`),
            },
        });
        const pageData = users.map((item) => {
            const newItem = {
              ...item,
            };
            return newItem;
          });
      
          return { pageData, total };
    }

    findOne(id: number): Promise<AchievementType | null> {
        return this.achievementTypesRepository.findOneBy({ id });
    }

    async create(typeData: Partial<AchievementType>): Promise<AchievementType> {
        const type = this.achievementTypesRepository.create(typeData);
        return this.achievementTypesRepository.save(type);
    }

    async update(id: number, typeData: Partial<AchievementType>): Promise<AchievementType> {
        await this.achievementTypesRepository.update(id, typeData);
        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.achievementTypesRepository.delete(id);
    }
}