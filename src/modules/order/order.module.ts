import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { WxPayService } from './WxPay.service';
import { Order } from './order.entity';
import { AuthCenterModule } from '@/modules/auth-center/auth-center.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => AuthCenterModule)
  ],
  controllers: [OrderController],
  providers: [OrderService, WxPayService, Object],
  exports: [OrderService]
})
export class OrderModule {}
