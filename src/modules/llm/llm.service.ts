import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { Readable } from 'stream';

/**
 * LLMService —— 纯透明转发器
 *
 * 设计原则：
 *  - 后端不再做 prompt 拼装、tool_choice 策略、输出清洗、JSON parse / serialize。
 *  - 前端发送完整的 OpenAI Chat Completions 请求体，后端仅追加 Authorization +
 *    强制 stream:true，然后把上游 SSE 字节流原样吐回给前端。
 *  - 所有 ReAct 编排、tool_calls 拼接、停止词、节流参数、错误恢复都由前端
 *    AgentRuntime + Skill 控制，后端做到 "可有可无 / 可替换为任意 OpenAI 兼容代理"。
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger('LLMService');
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.LLM_SILICONFLOW_KEY || 'sk-betbqvqrfonowtkyfajxcucfzvflzdpokovambjwrhfagtkv';
    this.defaultModel = process.env.LLM_MODLE || 'Qwen/Qwen2.5-7B-Instruct';
    this.baseUrl = process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';
    this.logger.log(
      `init defaultModel=${this.defaultModel} baseUrl=${this.baseUrl} apiKey=${this.apiKey ? this.apiKey.slice(0, 6) + '***' : 'MISSING'}`,
    );
  }

  /**
   * 打开上游 chat.completions 流式连接，返回原始 axios stream + http status。
   * 由 controller 负责 byte-pipe 给前端，不在此处做任何 JSON 处理。
   *
   * @param body  前端透传的 OpenAI 兼容 body (messages/tools/tool_choice/...)
   * @param signal AbortSignal —— 客户端断开时取消上游
   */
  async openUpstreamStream(
    body: Record<string, any>,
    signal: AbortSignal,
  ): Promise<{ status: number; stream: Readable; model: string }> {
    const payload: Record<string, any> = {
      ...body,
      stream: true,
      model: body?.model || this.defaultModel,
    };

    const t0 = Date.now();
    const lastRole = Array.isArray(body?.messages) && body.messages.length
      ? body.messages[body.messages.length - 1]?.role
      : undefined;
    this.logger.log(
      `[upstream] → model=${payload.model} msgs=${body?.messages?.length || 0}(last=${lastRole}) tools=${body?.tools?.length || 0} tool_choice=${body?.tool_choice || 'n/a'}`,
    );

    const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      responseType: 'stream',
      signal,
      // 仅限制连接 + 首字节阶段；axios stream 不限 body 持续时长 (流式可能数十秒)
      timeout: 30000,
      validateStatus: () => true,
      // 关键：禁用 axios 默认对响应体的转换，保持原始 chunk 字节
      transformResponse: (d) => d,
    });

    this.logger.log(`[upstream] ← ${response.status} after ${Date.now() - t0}ms`);
    return { status: response.status, stream: response.data as Readable, model: payload.model };
  }
}