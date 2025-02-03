import {
  Allow
} from 'class-validator';
import { OrderStatus } from './order.enum';

export class GetOrderDto{
  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;
  
  @Allow()
  systemId?: number;

  @Allow()
  startTime?: number;

  @Allow()
  productId: string;

  @Allow()
  productCode: string;

  @Allow()
  endTime?: number;

  @Allow()
  orderStatus: OrderStatus;

  @Allow()
  orderId?: number;

  @Allow()
  userId?: number;
}
