import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { System } from './system.entity';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([System]),
    forwardRef(() => AuthCenterModule)
  ],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService]
})
export class SystemModule {}