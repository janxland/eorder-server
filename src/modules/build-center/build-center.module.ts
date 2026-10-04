/**
 * 构建中心模块
 * website: https://www.roginx.ink
 */

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildCenterController } from './build-center.controller';
import { BuildCenterService } from './build-center.service';
import { BuildRecord } from './build-record.entity';
import { BuildPointer } from './build-pointer.entity';
import { BuildCleanup } from './build-cleanup.entity';
import { StorageConfig } from '@/modules/cloud-storage/entities/storage-config.entity';
import { CloudStorageModule } from '@/modules/cloud-storage/cloud-storage.module';
import { GrayReleaseModule } from '@/modules/gray-release/gray-release.module';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BuildRecord, BuildPointer, BuildCleanup, StorageConfig]),
    forwardRef(() => AuthCenterModule),
    forwardRef(() => CloudStorageModule),
    forwardRef(() => GrayReleaseModule),
  ],
  controllers: [BuildCenterController],
  providers: [BuildCenterService],
  exports: [BuildCenterService],
})
export class BuildCenterModule {}
