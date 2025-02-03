import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { System } from './system.entity';
import { CreateSystemDto, UpdateSystemDto } from './dto';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(System)
    private systemRepository: Repository<System>,
  ) {}

  async findAll(): Promise<System[]> {
    return this.systemRepository.find();
  }

  async findOne(id: number): Promise<System> {
    return this.systemRepository.findOneBy({ id });
  }

  async create(systemData: CreateSystemDto): Promise<System> {
    const existingSystem = await this.systemRepository.findOneBy({ 
      name: systemData.name 
    });

    if (existingSystem) {
      throw new Error('System name already exists');
    }

    const newSystem = this.systemRepository.create({
      ...systemData,
      enable: systemData.enable ?? true // 默认启用
    });
    
    return this.systemRepository.save(newSystem);
  }

  async update(id: number, updateData: UpdateSystemDto): Promise<System> {
    await this.systemRepository.update(id, updateData);
    return this.systemRepository.findOneBy({ id });
  }

  async delete(id: number): Promise<void> {
    await this.systemRepository.delete(id);
  }
}