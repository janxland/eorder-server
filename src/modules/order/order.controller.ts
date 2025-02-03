import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './order.entity';
const allowedIps = ['YOUR_ALLOWED_IPS']; // 配置允许的IP列表
@Controller('orderss')
// @UseGuards(AuthGuard('jwt'))
export class OrderController {
  constructor(private readonly orderService: OrderService) {
      console.log('OrderController instantiated');
  }
  // @Post('notify')
  // async handleWxPayNotify(@Req() req): Promise<void> {
  //   console.log(req);
  //   const clientIp = req.ip;  // 获取来访IP
  //   try {
      
  //     if (!allowedIps.includes(clientIp)) {
  //       console.warn(`Unauthorized IP: ${clientIp}`);
  //     } else {
  //       const notificationData = req.body;
  //       let order = new Order();
  //       await this.orderService.saveOrder(order);
  //     }
  //   } catch (error) {
  //     console.error('Error handling WX Pay notification:', error);
  //   }
  // }
  /**
   * 查询订单状态（同时状态入库）
   *
   * @param out_trade_no 外部交易号
   * @returns 返回订单查询结果
   */
  @Get('/query')
  queryOrder(@Query('out_trade_no') out_trade_no: string,@Query('orderId') orderId) {
    return this.orderService.queryOrder(out_trade_no || orderId);
  }
  @Post('/select')
  selectOrders(@Body() selectOrders: Partial<Order>,@Query('num') num: number,@Query('page') page: number) {
    return this.orderService.selectOrders(selectOrders,num,page);
  }
  /**
   * 保存订单
   *
   * @param order 订单对象
   * @returns 返回保存订单的结果（通常是保存后的订单对象或保存状态）
   */
  @Post('/createOrder')
  saveOrder(@Body() order,@Req() req) {
    order.IPAddress = req.ip || req.connection.remoteAddress;
    return this.orderService.createOrder(order);
  }
  /**
   * 
   * @param orderIds 
   * @param num 
   * @param page 
   * @returns 
  */
  @Get('/list')
  listOrders(@Query('orderIds') orderIds: string,@Query('num') num: number,@Query('page') page: number){
    return this.orderService.listOrders(orderIds,num,page);
  }

  @Get("/get")
  /**
   * 获取订单信息
   *
   * @param orderId 订单ID，通过查询参数传递
   * @returns 返回订单信息
   */
  getOrder(@Query('orderId') orderId: string) {
    return this.orderService.getOrder(orderId);
  }

  @Post('/update')
  saveOne(@Body() order) {
    return this.orderService.saveOne(order);
  }

}
