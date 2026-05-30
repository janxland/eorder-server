import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PredictRequest } from './predict.dto';
import { LLMService } from './llm.service';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { Public } from '@/common/decorators/public.decorator';

@Controller('/llm')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class LLMController {
  private readonly logger = new Logger('LLMController');
  constructor(private readonly llmService: LLMService) {}

  /**
   * 流式 LLM 接口 —— 纯字节透传代理
   *
   * 协议契约 (与前端 AgentRuntime 配对)：
   *  - 入参：完整的 OpenAI Chat Completions 请求体 (messages/tools/tool_choice/...)
   *  - 出参：上游 SSE 字节流 *原样* 回写 (即 `data: {choices:[{delta:{...}}]}\n\n` 形态)
   *  - 后端不做 JSON parse / 字段重命名 / prompt 拼装 / 安全策略
   *  - 仅在以下场景额外注入帧：
   *      1) 立即回写 `: connected\n\n` 让 fetch 首字节及时到达
   *      2) 上游首字节到达前每 20s 心跳 `: ping...\n\n`
   *      3) 上游 4xx/5xx 或异常时回写 `data: {"error":"..."}\n\n` + `data: [DONE]\n\n`
   *  - 客户端断开 → 立即 abort 上游
   *
   * 注意：使用 @Res() 后 Nest 进入 library mode，方法级 @Header 装饰器会失效，
   *       因此 headers 必须在方法体内手动 setHeader + flushHeaders。
   */
  @Post('predict_stream')
  @Public()
  async predictStream(
    @Req() req: Request,
    @Body() body: PredictRequest,
    @Res() res: Response,
  ) {
    const t0 = Date.now();
    const reqId = Math.random().toString(36).slice(2, 8);
    this.logger.log(
      `[${reqId}] ← POST /llm/predict_stream msgs=${body?.messages?.length || 0} tools=${body?.tools?.length || 0} tool_choice=${(body as any)?.tool_choice || 'n/a'} model=${body?.model || 'default'}`,
    );

    if (!Array.isArray(body?.messages) || !body.messages.length) {
      throw new HttpException('messages 不能为空', HttpStatus.BAD_REQUEST);
    }

    // ---- 1. 立即 flush SSE 头部 (让前端 fetch 立刻收到响应头) ----
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 Nginx 缓冲
    res.status(HttpStatus.OK);
    res.flushHeaders();
    res.write(': connected\n\n'); // 强制 flush 首帧

    // ---- 2. 客户端断连 → 取消上游 ----
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

    // ---- 3. 心跳：等待上游首字节期间 20s 一次保活；收到数据后停发 ----
    let gotFirstByte = false;
    const heartbeat = setInterval(() => {
      if (closed || gotFirstByte) return;
      try { res.write(`: ping ${Date.now() - t0}ms\n\n`); } catch { /* ignore */ }
    }, 20000);

    const writeFrame = (obj: Record<string, any>) => {
      if (closed) return;
      try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* ignore */ }
    };

    let totalBytes = 0;
    try {
      const { status, stream } = await this.llmService.openUpstreamStream(
        body as Record<string, any>,
        abortCtrl.signal,
      );

      // 上游错误：把错误体读完写一帧再 [DONE]
      if (status >= 400) {
        let errBody = '';
        try {
          for await (const c of stream) errBody += c.toString('utf8');
        } catch { /* ignore */ }
        this.logger.error(`[${reqId}] upstream ${status} body=${errBody.slice(0, 500)}`);
        writeFrame({ error: `上游 ${status}: ${errBody.slice(0, 300) || 'no body'}` });
        if (!closed) {
          try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* ignore */ }
        }
        return;
      }

      // 关键：byte-pipe，不做任何 JSON parse
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          if (closed) return;
          gotFirstByte = true;
          totalBytes += chunk.length;
          try { res.write(chunk); } catch { /* ignore */ }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err: any) => reject(err));
        // 客户端断开时让上游 stream 也尽快 end
        abortCtrl.signal.addEventListener('abort', () => {
          try { (stream as any).destroy?.(); } catch { /* ignore */ }
          resolve();
        });
      });

      if (!closed) {
        // 上游若已经发了 [DONE] 则前端会忽略我们多发的；为了简单一致仍发一次
        try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* ignore */ }
      }
      this.logger.log(`[${reqId}] → done bytes=${totalBytes} total=${Date.now() - t0}ms`);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
        this.logger.warn(`[${reqId}] canceled after ${Date.now() - t0}ms`);
        if (!closed) {
          try { res.end(); } catch { /* ignore */ }
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${reqId}] ✗ ${msg} after ${Date.now() - t0}ms`);
        if (!closed) {
          writeFrame({ error: msg });
          try { res.write('data: [DONE]\n\n'); res.end(); } catch { /* ignore */ }
        }
      }
    } finally {
      clearInterval(heartbeat);
    }
  }
}
