import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ePayController } from './epay.controller';
import { ePayService } from './epay.service';
import { Order } from '../order/order.entity';
import { RabbitMQService } from '../rabbitmq.service';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
    ]),
    forwardRef(() => AuthCenterModule)
  ],
  controllers: [ePayController],
  providers: [ePayService, RabbitMQService, Object],
  exports: [ePayService]
})
export class ePayModule {}
