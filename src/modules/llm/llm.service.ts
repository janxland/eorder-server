import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Tools } from './tools';

@Injectable()
export class LLMService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private tokenCount = 0; // 用于记录 tokens

  constructor() {
    // 实际中可优先从环境变量取，如 process.env.API_KEY
    this.apiKey = process.env.LLM_SILICONFLOW_KEY || 'sk-betbqvqrfonowtkyfajxcucfzvflzdpokovambjwrhfagtkv';
    // 这里示例：Qwen 或 Moonshot
    this.model = process.env.LLM_MODLE || 'Qwen/Qwen2.5-7B-Instruct';
    // 这里示例：siliconflow 的地址
    this.baseUrl = process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';
  }
  private formatTools(tools: any[]): any[] {
    return tools.map(tool => {
      const functionParams = {
        type: 'object',
        required: tool.required_parameters,
        properties: {}
      };

      if (tool.parameters) {
        for (const [paramName, paramDetails] of Object.entries(tool.parameters)) {
          functionParams.properties[paramName] = paramDetails;
        }
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: functionParams
        },
        path: '' // 如果需要路径，可以在这里设置
      };
    });
  }
  /**
   * 发起"流式"请求，返回一个异步可迭代对象
   * 在 Controller 里可 for-await-of 逐段获取并往 SSE 输出
   */
  public async *predictStream(
    messages: any[],
    tools: any[] = [],
    temperature: number = 0.3,
    top_p: number = 0.9,
  ) {
    const payload = {
      model: this.model,
      messages,
      stream: true,
      temperature,
      top_p,
      "tools": this.formatTools(tools),
    };

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers,
        timeout: 60000,
        responseType: 'stream', // 关键：流式响应
      });
      
      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (let line of lines) {
            line = line.trim();
          if (!line.startsWith('data: ')) {
            continue;
          }
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') {
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse JSON:', jsonStr);
            continue;
          }
          
          if (parsed.choices && parsed.choices.length > 0) {
            for (const choice of parsed.choices) {
              const delta = choice.delta || {};
              const result: Record<string, any> = { role: 'assistant' };
              if (delta.content) {
                result.content = delta.content;
                yield result;
              }

              if (delta.tool_calls) {
                result.tool_calls = delta.tool_calls;
                yield result;
              }
            }
          }
        }
      }
      
    } catch (err) {
      console.error('Error in predictStream:', err);
      throw err;
    }
  }

  /**
   * 发起流式请求，但一次性把所有片段收集起来再返回
   * 类似你 Python 里的 /predict 接口
   */
  public async predictFull(inputText: string) {
    const messages = [{ role: 'user', content: inputText }];
    const payload = {
      model: this.model,
      messages,
      stream: true,
      tools: [],
    };

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const collected: Array<{ tool_calls?: any; content?: string }> = [];

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers,
        timeout: 60000,
        responseType: 'stream',
      });

      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data: ')) {
            continue;
          }
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') {
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse JSON:', jsonStr);
            continue;
          }

          if (parsed.choices && parsed.choices.length > 0) {
            for (const choice of parsed.choices) {
              const delta = choice.delta || {};

              if (delta.tool_calls) {
                collected.push({ tool_calls: delta.tool_calls });
              }
              if (delta.content) {
                collected.push({ content: delta.content });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in predictFull:', err);
      throw err;
    }

    return collected;
  }
}