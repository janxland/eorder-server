import { forwardRef, Module } from '@nestjs/common';
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
import { KeyVaultService } from './keyvault/keyvault.service';
import { StorageAccount } from './accounts/storage-account.entity';
import { StorageAccountService } from './accounts/storage-account.service';
import { StorageAccountController } from './accounts/storage-account.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StorageConfig, StorageAccount]),
    forwardRef(() => AuthCenterModule),
  ],
  controllers: [CloudStorageController, StorageConfigController, StorageAccountController],
  providers: [
    CloudStorageService,
    StorageConfigService,
    CloudStorageFactory,
    CosStorageProvider,
    OssStorageProvider,
    QiniuStorageProvider,
    KeyVaultService,
    StorageAccountService,
  ],
  exports: [CloudStorageService, StorageConfigService, StorageAccountService, KeyVaultService, CloudStorageFactory],
})
export class CloudStorageModule {}
