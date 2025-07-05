import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudStorageService } from './cloud-storage.service';
import { CloudStorageController } from './cloud-storage.controller';
import { StorageConfigService } from './storage-config.service';
import { StorageConfigController } from './storage-config.controller';
import { StorageConfig } from './entities/storage-config.entity';
import { CloudStorageFactory } from './providers/cloud-storage.factory';
import { CosStorageProvider } from './providers/cos-storage.provider';
import { OssStorageProvider } from './providers/oss-storage.provider';
import { QiniuStorageProvider } from './providers/qiniu-storage.provider';
import { AuthCenterModule } from '../auth-center/auth-center.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StorageConfig]),
    AuthCenterModule,
  ],
  controllers: [CloudStorageController, StorageConfigController],
  providers: [
    CloudStorageService,
    StorageConfigService,
    CloudStorageFactory,
    CosStorageProvider,
    OssStorageProvider,
    QiniuStorageProvider,
  ],
  exports: [CloudStorageService, StorageConfigService],
})
export class CloudStorageModule {} 