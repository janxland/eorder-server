/**
 * LLM Proxy Controller - Nginx Lua 鉴权后的代理请求处理
 *
 * 流程：浏览器 → xqjn.top/llm/ → Lua鉴权 → eorder-server → LLM服务商
 *
 * Nginx Lua 已经验证了 JWT 并创建了会话缓存
 * 这里只需要使用用户配置的 apiKey 和 target 来调用 LLM
 */

import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Controller('/api/llm')
export class LLMProxyController {
  private readonly logger = new Logger('LLMProxyController');

  @Post('v1/chat/completions')
  async chatCompletions(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-proxy-key') proxyKey: string,
    @Headers('x-proxy-target') proxyTarget: string,
  ) {
    const t0 = Date.now();
    const reqId = Math.random().toString(36).slice(2, 8);

    const apiKey = proxyKey || '';
    const targetBase = proxyTarget || process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';

    this.logger.log(
      `[${reqId}] ← POST /api/llm/v1/chat/completions target=${targetBase} key=${apiKey.slice(0, 8)}***`,
    );

    const body = req.body;

    if (!Array.isArray(body?.messages) || !body.messages.length) {
      throw new HttpException('messages 不能为空', HttpStatus.BAD_REQUEST);
    }

    // 流式响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(HttpStatus.OK);
    res.flushHeaders();
    res.write(': connected\n\n');

    // 客户端断连处理
    const abortCtrl = new AbortController();
    let closed = false;
    const onClose = () => {
      if (closed) return;
      closed = true;
      this.logger.warn(`[${reqId}] client closed @ ${Date.now() - t0}ms`);
      abortCtrl.abort();
    };
    req.on('close', onClose);
    req.on('aborted', onClose);

    // 心跳
    let gotFirstByte = false;
    const heartbeat = setInterval(() => {
      if (closed || gotFirstByte) return;
      try { res.write(`: ping ${Date.now() - t0}ms\n\n`); } catch {}
    }, 20000);

    try {
      const axios = require('axios');
      const response = await axios.post(
        `${targetBase}/chat/completions`,
        { ...body, stream: true },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          responseType: 'stream',
          signal: abortCtrl.signal,
          timeout: 120000,
          validateStatus: () => true,
        },
      );

      if (response.status >= 400) {
        let errBody = '';
        try {
          for await (const c of response.data) errBody += c.toString('utf8');
        } catch {}
        this.logger.error(`[${reqId}] upstream ${response.status}: ${errBody.slice(0, 300)}`);
        res.write(`data: ${JSON.stringify({ error: `上游 ${response.status}` })}\n\n`);
        if (!closed) res.end();
        return;
      }

      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          if (closed) return;
          gotFirstByte = true;
          try { res.write(chunk); } catch {}
        });
        response.data.on('end', () => resolve());
        response.data.on('error', (err: Error) => reject(err));
        abortCtrl.signal.addEventListener('abort', () => {
          try { (response.data as any).destroy?.(); } catch {}
          resolve();
        });
      });

      if (!closed) res.end();
      this.logger.log(`[${reqId}] → done total=${Date.now() - t0}ms`);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        if (!closed) res.end();
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${reqId}] ✗ ${msg}`);
        if (!closed) {
          res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
          res.end();
        }
      }
    } finally {
      clearInterval(heartbeat);
    }
  }
}
