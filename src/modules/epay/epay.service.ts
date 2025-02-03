import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { InjectRepository } from '@nestjs/typeorm';
import * as qs from 'qs';
import { RCode } from '@/constants/rcode';
import { Order } from '../order/order.entity';
import { GetOrderDto } from '../order/dto';
import * as utility from 'utility';
import { RabbitMQService } from '../rabbitmq.service';
dotenv.config();

@Injectable()
export class ePayService {
  private readonly pid: string;
  private readonly key: string;
  private readonly submitUrl: string;
  private readonly mapiUrl: string;
  private readonly apiUrl: string;
  private readonly return_url = process.env.EPAY_RETURN_URL;
  private readonly notify_url = process.env.EPAY_NOTIFY_URL;
  private readonly signType = 'MD5';
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    private readonly rabbitMQService: RabbitMQService
  ) {
    this.pid = process.env.EPAY_PID;
    this.key = process.env.EPAY_KEY;
    this.submitUrl = `${process.env.EPAY_API_URL}/submit.php`;
    this.mapiUrl = `${process.env.EPAY_API_URL}/mapi.php`;
    this.apiUrl = `${process.env.EPAY_API_URL}/api.php`;
  }
  async findAll(query: GetOrderDto) {
    const pageSize = query.pageSize || 10;
    const pageNo = query.pageNo || 1;
  
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product') // 关联商品信息
      .where('1 = 1');
  
    // 订单ID筛选
    if (query.orderId) {
      queryBuilder.andWhere('order.orderId LIKE :orderId', { 
        orderId: `%${query.orderId}%` 
      });
    }
  
    // 用户ID筛选
    if (query.userId) {
      queryBuilder.andWhere('order.userId = :userId', { 
        userId: query.userId 
      });
    }
  
    // 支付状态筛选
    if (query.orderStatus) {
      queryBuilder.andWhere('order.orderStatus = :orderStatus', {
        orderStatus: query.orderStatus
      });
    }
  
    // 支付时间范围筛选
    if (query.startTime && query.endTime) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startTime AND :endTime', {
        startTime: query.startTime,
        endTime: query.endTime
      });
    }
  
    const [orders, total] = await queryBuilder
      .orderBy('order.createTime', 'DESC') // 按创建时间倒序
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
  
    // 格式化返回数据
    const pageData = orders.map(order => ({
      ...order,
      productCode: order.productCode || order.productCode, // 优先取商品表的code
      productName: order.product?.name || '', // 关联商品名称
      productPrice: order.product?.price || 0 // 关联商品价格
    }));
  
    return { pageData, total };
  }
  // 发起支付 (获取支付链接)
  async getPayLink(params: Record<string, any>): Promise<string> {
    const param = this.buildRequestParam(params);
    const queryString = new URLSearchParams(param).toString();
    return `${this.submitUrl}?${queryString}`;
  }

  // 发送回调请求的可复用函数
  private async sendCallback(url: string, data: Record<string, any>): Promise<void> {
    try {
      await axios({
        method: 'POST',
        url: url,
        data: qs.stringify(data),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.8',
          'Connection': 'close',
        },
      });
    } catch (error) {
      console.error('回调请求失败:', error);
      throw new Error('回调请求失败');
    }
  }

  // 发起支付 (API接口)
  async apiPay(order: Order, params: Record<string, any>, qrcode: boolean | null = null): Promise<any> {
    try {
      let newOrder = new Order();
      Object.assign(newOrder, order);
      
      const existingOrderCount = await this.orderRepository.count({ where: { orderId: newOrder.orderId } });
      if (existingOrderCount > 0) {
        throw new Error('订单ID已存在');
      }
      const requestParams = {
        pid: this.pid,
        key: this.key,
        type: params.type || 'alipay',
        return_url: process.env.EPAY_RETURN_URL || 'http://pay.roginx.ink/epay/return',
        notify_url: process.env.EPAY_NOTIFY_URL || 'http://pay.roginx.ink/epay/notify',
        sign_type: this.signType,
        name: '简思文创'+params.productDescription,
        out_trade_no: newOrder.orderId,
        money: newOrder.amount || 1,
        clientip: newOrder.IPAddress || "127.0.0.1",
      };
      const param = this.buildRequestParam(requestParams);
      const response = await this.getHttpResponse(this.mapiUrl, param);
      
      if (response.code == 1) {
        newOrder.paymentType = params.type;
        newOrder.transactionId = response.trade_no;
        newOrder.transactionInfo = JSON.stringify({ code_url: response.prcode });
        const savedOrder = await this.orderRepository.save(newOrder);
        // 回调处理
        if (params.verifyNotifyURL) {
          await this.sendCallback(params.verifyNotifyURL, {
            code: RCode.OK,
            msg: '订单生成成功',
            data: {
              money: newOrder.amount,
              orderId: savedOrder.orderId,
              code_url: response.qrcode,
              type: response.type,
              trade_no: response.trade_no,
            },
          });
        }
        this.rabbitMQService.sendPaymentMessage("CREAT",savedOrder);
        return { 
          code: RCode.OK, 
          msg: '订单生成成功', 
          data: { 
            money: newOrder.amount,
            orderId: savedOrder.orderId, 
            code_url: response.qrcode, 
            type: response.type,
            trade_no: response.trade_no
          }
        };
      } else {
        return { code: RCode.ERROR, msg: '订单生成失败，但已经创建支付单', data: response };
      }
    } catch (error) {
      return { code: RCode.ERROR, msg: '订单生成失败', data: error };
    }
  }

  async updateOrderStatus(query: any): Promise<string>  {
    let statusMap = {
      TRADE_SUCCESS: 'SUCCESS',
      TRADE_CLOSED: 'CLOSED',
      WAIT_BUYER_PAY: 'WAIT_BUYER_PAY',
      TRADE_FINISHED: 'TRADE_FINISHED',
    };
    let newOrder = Object.assign(new Order(), {
      orderId: query.out_trade_no,
      orderStatus: statusMap[query.trade_status]
    });
    let saveOrder = await this.orderRepository.save(newOrder);

    // 发送支付成功消息到RabbitMQ
    await this.rabbitMQService.sendPaymentMessage("STATUS",saveOrder);
    throw new Error('Method not implemented.');
  }
  
  // 异步回调验证
  verifyNotify(query: Record<string, any>): boolean {
    if (Object.keys(query).length === 0) return false;
    const sign = this.getSign(query);
    return sign === query['sign'];
  }

  // 同步回调验证
  verifyReturn(query: Record<string, any>): boolean {
    if (Object.keys(query).length === 0) return false;
    const sign = this.getSign(query);
    return sign === query['sign'];
  }

  // 查询订单支付状态
  async orderStatus(tradeNo: string, orderId: string): Promise<boolean> {
    const result = await this.queryOrder(tradeNo);
    if (result && result.status === 1) {
      return true;
    } else {
      return false;
    }
  }

  // 查询订单（数据库
  async queryOrderFromNative(tradeNo: string): Promise<any> {
    let oneOrder = await this.orderRepository.findOne({
      where: [
        { orderId: tradeNo },
        { transactionId: tradeNo }, // 另一个查询条件由于本地商户号订单ID是UUID
      ],
    });
    return oneOrder;
  }
  // 查询订单（丰富条件
  async queryOne(queryDto: GetOrderDto): Promise<any> {
    const whereConditions: any = {};
    console.log('queryDto:', queryDto);
    
    if (queryDto.pageSize) {
      whereConditions.pageSize = queryDto.pageSize;
    }
  
    if (queryDto.pageNo) {
      whereConditions.pageNo = queryDto.pageNo;
    }
  
    if (queryDto.systemId) {
      whereConditions.systemId = queryDto.systemId;
    }
  
    if (queryDto.startTime) {
      whereConditions.startTime = queryDto.startTime;
    }
  
    if (queryDto.endTime) {
      whereConditions.endTime = queryDto.endTime;
    }
  
    if (queryDto.orderStatus) {
      whereConditions.orderStatus = queryDto.orderStatus;
    }
  
    if (queryDto.orderId) {
      whereConditions.orderId = queryDto.orderId;
    }
  
    if (queryDto.userId) {
      whereConditions.userId = queryDto.userId;
    }
  
    // You can also implement pagination or other logic as required
  
    let orders = await this.orderRepository.findOne({
      where: whereConditions,
    });
  
    return orders;
  }
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

  private generateSign(params: Record<string, any>): string {
    // 1. 过滤不需要签名的字段
    const ignoredKeys = ['sign', 'sign_type'];
    // 2. 过滤空值并排序
    const sortedParams = Object.keys(params)
      .filter(key => !ignoredKeys.includes(key) && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    // 3. 拼接密钥
    const signStr = `${sortedParams}${this.key}`;
    console.log('signStr', signStr);
    
    // 4. 生成MD5签名
    return crypto.createHash('md5').update(signStr).digest('hex');
  }
  getVerifyParams(params) {
    var sPara = [];
    if(!params) return null;
    for(var key in params) {
        if((!params[key]) || key == "sign" || key == "sign_type") {
            continue;
        };
        sPara.push([key, params[key]]);
    }
    sPara = sPara.sort();
    var prestr = '';
    for(var i2 = 0; i2 < sPara.length; i2++) {
        var obj = sPara[i2];
        if(i2 == sPara.length - 1) {
            prestr = prestr + obj[0] + '=' + obj[1] + '';
        } else {
            prestr = prestr + obj[0] + '=' + obj[1] + '&';
        }
    }
    console.log('prestr', prestr);
    let sign=utility.md5(prestr+this.key);
    
    return sign;
  }
  async queryOrder(tradeNo: string): Promise<any> {
    try {
      const baseParams = {
        time:Math.floor(Date.now() / 1000),
        act:"order",
        pid:Number(this.pid),
        out_trade_no:tradeNo,
      };

      // 生成签名
      const sign = this.getVerifyParams(baseParams);

      // 完整请求参数
      const requestParams = {
        ...baseParams,
        sign:sign,
        sign_type:"MD5",
      };
      console.log('requestParams', requestParams);
      
      const response = await axios.post(this.apiUrl, requestParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      

      if (response.status !== 200) {
        throw new Error(`请求失败，状态码：${response.status}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`订单查询失败: ${error.message}`);
      }
      throw new Error('未知的订单查询错误');
    }
  }

  // 请求外部资源
  private async getHttpResponse(url: string, postData: Record<string, any> | null = null, timeout: number = 10000): Promise<any> {
    try {
      if (postData) {
        const response = await axios({
          method: 'POST',
          url: url,
          data: qs.stringify(postData),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.8',
            'Connection': 'close',
          },
          timeout: timeout,
        });
        
        return response.data;
      } else {
        const response = await axios({
          method: 'GET',
          url: url,
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.8',
            'Connection': 'close',
          },
          timeout: timeout,
        });
        return response.data;
      }
    } catch (error) {
      console.error('请求失败:', error);
      throw new Error('Failed to fetch data from external resource.');
    }
  }

  async refund(tradeNo: string, amount: string): Promise<any> {
    const url = `${this.apiUrl}?act=refund`;
    const postData = {
      pid: this.pid,
      key: this.key,
      trade_no: tradeNo,
      money: amount,
    };
    const response = await this.httpPost(url, postData);
    return response;
  }

  private buildRequestParam(params: Record<string, any>): Record<string, any> {
    const sign = this.getSign(params);
    return {
      ...params,
      sign,
      sign_type: this.signType,
    };
  }

  private getSign(params: Record<string, any>): string {
    const ignoredKeys = ['sign', 'sign_type'];
    const sortedParams = Object.keys(params)
      .filter(key => !ignoredKeys.includes(key) && params[key] !== '')
      .sort()
      .reduce((acc, key) => `${acc}${key}=${params[key]}&`, '');
    if (!this.key) {
      throw new Error('Key is missing');
    }
  
    const signStr = `${sortedParams.slice(0, -1)}${this.key}`; 
    console.log('signStr', signStr);
    
    // 4. 生成 MD5 签名
    return crypto.createHash('md5').update(signStr).digest('hex');
  }

  private async httpGet(url: string): Promise<any> {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw new HttpException('Failed to fetch data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async httpPost(url: string, data: Record<string, any>): Promise<any> {
    try {
      const queryParams = new URLSearchParams(data).toString(); 
      const fullUrl = `${url}?${queryParams}`; 
      const response = await axios.post(fullUrl);
      return response.data;
    } catch (error) {
      throw new HttpException('Failed to post data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  
}
