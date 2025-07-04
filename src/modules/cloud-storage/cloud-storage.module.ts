import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageConfig } from './entities/storage-config.entity';
import { StorageConfigService } from './storage-config.service';
import { StorageConfigController } from './storage-config.controller';
import { CloudStorageFactory } from './providers/cloud-storage.factory';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StorageConfig]),
  ],
  controllers: [StorageConfigController, CloudStorageController],
  providers: [StorageConfigService, CloudStorageFactory, CloudStorageService],
  exports: [StorageConfigService, CloudStorageService],
})
export class CloudStorageModule {} 