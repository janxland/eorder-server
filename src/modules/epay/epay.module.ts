import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ePayController } from './epay.controller';
import { ePayService } from './epay.service';
import { Order } from '../order/order.entity';
import { RabbitMQService } from '../rabbitmq.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
    ]),
  ],
  controllers: [ePayController],
  providers: [ePayService,RabbitMQService,Object],
})
export class ePayModule {}
