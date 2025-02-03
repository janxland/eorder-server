/** eslint-disable */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { WxPayService } from './WxPay.service';
import { OrderStatus } from './order.enum';
import { Order } from './order.entity';
import { RCode } from '@/constants/rcode';
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private WxPay,
  ) {
    this.WxPay = new WxPayService().WxPayService;
  }
  
  async notify(req) {
    try {
      const headers = req.headers; // 请求头信息
      const params = {
        apiSecret: 'APIv3密钥', // 如果在构造中传入了 key, 这里可以不传该值，否则需要传入该值
        body: req.body, // 请求体 body
        signature: headers['wechatpay-signature'],
        serial: headers['wechatpay-serial'],
        nonce: headers['wechatpay-nonce'],
        timestamp: headers['wechatpay-timestamp'],
      };
      const ret = await this.WxPay.verifySign(params);
      console.log('验签结果(bool类型)：' + ret);
      return ret;
    } catch (e) {
     
    }
  }
  /**
   * 根据订单ID获取订单信息
   *
   * @param orderId 订单ID
   * @returns 返回获取订单的结果，包括状态信息、消息和订单数据
   */
  async getOrder(orderId: string) {
    try {
      let res;
      if (orderId) {
        res = await this.orderRepository.findOne({
          where: { orderId: orderId },
        });
        return { msg: '获取简历成功', data:res };
      }
    } catch (e) {
      return { code: RCode.ERROR, msg: '获取简历失败', data: e };
    }
  }
  /**
   * 查询订单信息
   *
   * @param out_trade_no 订单号
   * @returns 查询结果，包含查询状态信息和订单数据
   */
  async queryOrder(out_trade_no: string) {
    try {
      const res = await this.WxPay.query({ out_trade_no });
      const { data } = res;
      let order: Order = new Order();
      order.orderId = out_trade_no;
      order.transactionId = data.transaction_id;
      if(data.trade_state == "SUCCESS") {
        order.orderStatus = OrderStatus.PAID;
        await this.orderRepository.save(order);
      }
      const queryOrder = await this.orderRepository.findOne({ where: { orderId: out_trade_no } });
      
      return { msg: '查询成功', data: queryOrder };
    } catch (e) {
      console.log(e);
      
      return { code: RCode.ERROR, msg: '查询失败', data: e };
    }
  }
  async createOrder(order: Order) {
    try {
      let newOrder = Object.assign(new Order(), order);
  
      // 检查是否存在相同 orderId 的订单
      const existingOrder = await this.orderRepository.findOne({
        where: { orderId: order.orderId },
      });
  
      if (existingOrder) {
        throw new Error('订单ID已存在');
      }
  
      const params = {
        description: newOrder.productDescription || '一个普通商品',
        out_trade_no: newOrder.orderId,
        notify_url: 'https://pay.roginx.ink/order/notify',
        amount: {
          total: newOrder.amount || 1,
        },
        scene_info: {
          payer_client_ip: newOrder.IPAddress || "127.0.0.1",
        },
      };
  
      const result = await this.WxPay.transactions_native(params);
      if (result.status == 200) {
        newOrder.transactionInfo = JSON.stringify(result.data);
        const savedOrder = await this.orderRepository.save(newOrder);
        return { code: RCode.OK, msg: '订单生成成功', data: { orderId: savedOrder.orderId, code_url: result.data.code_url } };
      }
      return { code: RCode.ERROR, msg: '订单生成失败', data: result };
    } catch (e) {
      console.error('Error saving the order:', e);
      return { code: RCode.ERROR, msg: '保存订单失败', data: e };
    }
  }
  /**
   * 有条件地获取订单（查询订单状态用）
   * @param order 
   * @param num 
   * @param page 
   * @returns 
   */
  async selectOrders(order: Partial<Order>, num = 10,page = 1 ) {
    try {
      let queryBuilder = this.orderRepository.createQueryBuilder('order');
      Object.keys(order).forEach(key => {
        if (order[key] !== undefined) {
          queryBuilder = queryBuilder.andWhere(`order.${key} = :${key}`, { [key]: order[key] });
        }
      });
      const totalCount = await queryBuilder.getCount();
      queryBuilder = queryBuilder.skip((page - 1) * num).take(num);
      const data = await queryBuilder.getMany();
      const totalPage = Math.ceil(totalCount / num); // Calculate total pages
      return { msg: '获取订单列表成功！', data, totalPage, totalCount };
    } catch (e) {
      return { code: 'ERROR', msg: '获取订单失败', data: e };
    }
  }
  /**
   * 获取订单列表
   * @param orderIds 
   * @param num 
   * @param page 
   * @returns 
   */
  async listOrders(orderIds: string = '', num: number = 10, page: number = 1) {
    try {
      let queryBuilder = this.orderRepository.createQueryBuilder('order');
  
      if (orderIds) {
        const orderIdArr = orderIds.split(',').filter(id => id.trim());
        queryBuilder = queryBuilder.where('order.orderId IN (:...orderIdArr)', { orderIdArr });
      }
      const totalCount = await queryBuilder.getCount();
  
      if (!orderIds) {
        queryBuilder = queryBuilder.skip((page - 1) * num).take(num);
      }
      const data = await queryBuilder.getMany();
      const totalPage = Math.ceil(totalCount / num); // Calculate total pages
      return { msg: '获取订单列表成功！', data, totalPage, totalCount };
    } catch (e) {
      return { code: 'ERROR', msg: '获取订单失败', data: e };
    }
  }
  
  async saveOne(order: Order) {
    try {
      let one = await this.orderRepository.findOne({
        where: { orderId: order.orderId },
      });
      if (!one) {
        one = this.orderRepository.create(order);
      } else {
        one = this.orderRepository.merge(one, order);
      }
      // Object.assign(user, updateData);
      const savedOne = await this.orderRepository.save(one);
      return { code: RCode.OK, msg: '简历保存成功', data: savedOne };
    } catch (e) {
      console.error('Error saving the order:', e);
      return { code: RCode.ERROR, msg: '保存简历失败', data: e };
    }
  }
 
}
