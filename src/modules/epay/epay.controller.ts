import { Controller, Post, Body, Get, Query, HttpException, HttpStatus, Param ,Req, UseGuards} from '@nestjs/common';
import { ePayService } from './epay.service'; // 假设你已经在NestJS中创建了一个对应的service
import { Order } from '../order/order.entity';
import { RCode } from '@/constants/rcode';
import { GetOrderDto } from '../order/dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('epay')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class ePayController {
  constructor(private readonly epayService: ePayService) {
  }
  @Get()
  @RequirePermission(PermissionCode.SHOW_PAY_ORDER_LIST)
  getAll(@Query() queryDto: GetOrderDto){
      return this.epayService.findAll(queryDto);
  }
  // // 发起支付 (页面跳转)
  // @Post('pagePay')
  // async pagePay(@Body() payDto: any): Promise<string> {
  //   try {
  //     const result = this.epayService.pagePay(payDto);
  //     return result;
  //   } catch (error) {
  //     throw new HttpException('Payment failed', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }

  // 获取支付链接
  @Post('getPayLink')
  @RequirePermission(PermissionCode.GET_PAY_LINK)
  async getPayLink(@Body() payDto: any): Promise<string> {
    try {
      const result = this.epayService.getPayLink(payDto);
      return result;
    } catch (error) {
      throw new HttpException('Payment failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }

  // API支付
  @Post('createOrder')
  @RequirePermission(PermissionCode.CREATE_PAY_ORDER)
  async apiPay(@Body() order,@Query() payDto: any,@Req() req): Promise<any> {
    try {
      console.log(order,payDto);
      
      let newOrder = Object.assign(new Order(),order,payDto);
      newOrder.IPAddress = req.ip || req.connection.remoteAddress;
      const result = await this.epayService.apiPay(order,payDto);
      return result
    } catch (error) {
      throw new HttpException('API payment failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 订单完成/订单过期异步回调验证
  @Get('notify')
  @RequirePermission(PermissionCode.VERIFY_PAY_NOTIFY)
  async verifyNotify(@Query() query: any): Promise<boolean> {
    try {
      const result = await this.epayService.verifyNotify(query);
      if(result) {
        await this.epayService.updateOrderStatus(query);
        return true
      }
      return result;
    } catch (error) {
      throw new HttpException('Verification failed', HttpStatus.BAD_REQUEST);
    }
  }

  // 同步回调验证
  @Get('return')
  @RequirePermission(PermissionCode.VERIFY_PAY_NOTIFY)
  async verifyReturn(@Query() query: any): Promise<boolean> {
    try {
      const result = await this.epayService.verifyReturn(query);
      return result;
    } catch (error) {
      throw new HttpException('Verification failed', HttpStatus.BAD_REQUEST);
    }
  }

  // 查询订单支付状态
  @Get('query')
  @RequirePermission(PermissionCode.QUERY_PAY_ORDER)
  async orderStatus(@Query('orderId',) orderId ,@Body() queryData: GetOrderDto) {
    if(orderId) {
      queryData.orderId = orderId;
    }
    try {
      const result = await this.epayService.queryOne(queryData);
      return result;
    } catch (error) {
      throw new HttpException('Order status check failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
    // 查询订单支付状态
    @Get('queryone')
    @RequirePermission(PermissionCode.QUERY_PAY_ORDER)
    async queryOne(@Query() queryData1: GetOrderDto,@Body() queryData2: GetOrderDto) {
      try {
        if(Object.keys(queryData1).length === 0) {
          queryData1 = queryData2;
        }
        const result = await this.epayService.queryOne(queryData1 || queryData2);
        return result;
      } catch (error) {
        throw new HttpException('Order status check failed', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  @Get('select')
  @RequirePermission(PermissionCode.SHOW_PAY_ORDER_LIST)
  async selectOrders(@Body() query: any): Promise<any> {
    try {
      const result = await this.epayService.selectOrders(query);
      return result;
    } catch (error) {
      throw new HttpException('Order selection failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }  
  @Get('queryepayorder')
  @RequirePermission(PermissionCode.QUERY_PAY_ORDER)
  async queryOrder(@Query('trade_no') tradeNo: string): Promise<any> {
    try {
      const result = await this.epayService.queryOrder(tradeNo);
      return result;
    } catch (error) {
      throw new HttpException('Order query failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 订单退款
  // @Post('refund')
  // async refund(@Body() refundDto: { trade_no: string; money: number }): Promise<any> {
  //   try {
  //     const { trade_no, money } = refundDto;
  //     const result = await this.epayService.refund(trade_no, money);
  //     return result;
  //   } catch (error) {
  //     throw new HttpException('Refund failed', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }
}
