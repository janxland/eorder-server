import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class WxPayService {
  public WxPayService;

  constructor() {
    // const WxPay = require('wechatpay-node-v3'); // 使用 require 导入

    // this.WxPayService = new WxPay({
    //   appid: process.env.WX_APPID || '默认的公众号或移动应用appid',
    //   mchid: process.env.WX_MCHID || '默认的商户号',
    //   publicKey: fs.readFileSync(process.env.WX_PUBLIC_KEY_PATH || './默认的公钥路径.pem'),
    //   privateKey: fs.readFileSync(process.env.WX_PRIVATE_KEY_PATH || './默认的私钥路径.pem'),
    // });
    this.WxPayService = {}
  }
  
}
