
import { Global, Injectable, Module } from '@nestjs/common';
import { KeyValue } from './key-value.entity';
import { KeyValueController } from './key-value.controller';
import { KeyValueService } from './key-value.service';
import { TypeOrmModule } from '@nestjs/typeorm';
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([KeyValue])],
  controllers: [KeyValueController],
  providers: [KeyValueService],
  exports: [KeyValueService],
})
export class KeyValueModule {}
