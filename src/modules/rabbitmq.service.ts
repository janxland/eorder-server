import { Injectable } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';
import { ePayService } from './epay/epay.service';

@Injectable()
export class RabbitMQService {
  private connection: Connection;
  private channel: Channel;
  private readonly epayService: ePayService
  private queueName = 'order.create.queue'; // 所有系统使用同一个队列
  constructor() {
    this.init();
  }

  private async init() {
    try {
      const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      const username = process.env.RABBITMQ_USERNAME || 'guest';
      const password = process.env.RABBITMQ_PASSWORD || 'guest';

      // 连接 RabbitMQ
      this.connection = await connect({
        protocol: 'amqp',
        hostname: rabbitUrl,
        username,
        password,
      });

      this.channel = await this.connection.createChannel();

      // 声明队列（确保队列存在）
      await this.channel.assertQueue(this.queueName, { durable: true });

      console.log(`✅ RabbitMQ 连接成功，监听队列：${this.queueName}`);
    } catch (error) {
      console.error('❌ RabbitMQ 连接失败:', error);
    }
  }

  async listenForOrderCreation() {
    try {
      // 监听统一的队列
      await this.channel.consume(this.queueName, (msg) => {
        if (msg) {
          const payload = JSON.parse(msg.content.toString());
          console.log(`接收到来自系统 ${payload.code} 的订单创建消息:`, payload);
          this.handleOrderFromSystem(payload);

          this.channel.ack(msg); // 确认消息
        }
      });

      console.log(`✅ 正在监听队列：${this.queueName}`);
    } catch (error) {
      console.error('❌ 监听队列失败:', error);
    }
  }

  // 根据 code 字段处理不同系统的订单创建需求
  private handleOrderFromSystem(payload: any) {
    this.epayService.apiPay(payload,payload).then(res => {
      console.log('申请结果', res);
      return res
    })
  }

  async sendPaymentMessage(action: string, payload: any) {
    payload.action = action;
    console.log('发送支付消息', JSON.stringify(payload));
    this.channel.sendToQueue(
      this.queueName,
      Buffer.from(JSON.stringify(payload)), // 将对象转为 JSON 字符串
      { persistent: true }
    );
  }

  async close() {
    await this.channel.close();
    await this.connection.close();
  }
}
