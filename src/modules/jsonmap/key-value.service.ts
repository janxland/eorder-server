import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyValue } from './key-value.entity';
import { CreateKeyValueDto, GetKeyValueDto, UpdateKeyValueDto } from './dto';


@Injectable()
export class KeyValueService {
  constructor(
    @InjectRepository(KeyValue)
    private readonly keyValueRepository: Repository<KeyValue>,
  ) {}

  async createOrUpdate(createDto: CreateKeyValueDto | UpdateKeyValueDto) {
    if ('id' in createDto) {
      return this.update(createDto as UpdateKeyValueDto);
    }
    return this.create(createDto);
  }

  async create(createDto: CreateKeyValueDto) {
    const entity = this.keyValueRepository.create(createDto);
    return this.keyValueRepository.save(entity);
  }

  async update(updateDto: UpdateKeyValueDto) {
    await this.keyValueRepository.update(updateDto.id, updateDto);
    return this.findOne(updateDto.id);
  }

  async findAll(query: GetKeyValueDto) {
    console.log(query);
    
    const pageSize = query.pageSize  || 10;
    const pageNo = query.pageNo  || 1;

    const queryBuilder = this.keyValueRepository 
        .createQueryBuilder('keyValue')
        .where('1 = 1');
    if (query.id) {
      queryBuilder.andWhere('keyValue.id = :id', { id: query.id });
    }
    // 根据Key筛选
    if (query.key)  {
        queryBuilder.andWhere('keyValue.key  LIKE :key', {
            key: `%${query.key}%` 
        });
    }

    // 根据Type筛选
    if (query.type)  {
        queryBuilder.andWhere('keyValue.type  = :type', {
            type: query.type 
        });
    }

    // 根据描述筛选
    if (query.desc)  {
        queryBuilder.andWhere('keyValue.desc  LIKE :desc', {
            desc: `%${query.desc}%` 
        });
    }

    // 根据创建时间范围筛选
    if (query.createdAt  && query.updatedAt)  {
        queryBuilder.andWhere('keyValue.createdAt  BETWEEN :createdAt AND :updatedAt', {
            createdAt: query.createdAt, 
            updatedAt: query.updatedAt 
        });
    }

    // 分页处理
    const [keyValues, total] = await queryBuilder
        .orderBy('keyValue.createdAt',  'DESC') // 按创建时间倒序排列
        .skip((pageNo - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

    return {
        pageData: keyValues,
        total
    };
  }

  async findOne(id: number) {
    return this.keyValueRepository.findOne({ where: { id } });
  }

  async delete(id: number) {
    return this.keyValueRepository.delete(id);
  }
}