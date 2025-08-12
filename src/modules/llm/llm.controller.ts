import {
  Controller,
  Post,
  Body,
  Res,
  Header,
  HttpException,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { LLMService } from './llm.service';

// 兼容old代码的DTO类
class PredictRequest {
  input_text: string;
  baseAPIHandler?: string;
  stream?: boolean;
  messages?: Array<any>;
  
  // 新字段（可选）
  app_config_id?: number;
  temperature?: number;
  max_tokens?: number;
}

@Controller('llm')
export class LLMController {
  constructor(private readonly llmService: LLMService) {}

  /**
   * 根路径测试接口
   */
  @Get()
  async root() {
    return {
      message: 'LLM module is working!',
      endpoints: [
        'GET /llm/test',
        'GET /llm/models',
        'GET /llm/apps',
        'POST /llm/predict',
        'POST /llm/predict_stream'
      ],
      timestamp: new Date().toISOString(),
      status: 'ok'
    };
  }

  /**
   * 测试接口 - 验证模块是否正常工作
   */
  @Get('test')
  async test() {
    return {
      message: 'LLM module is working!',
      timestamp: new Date().toISOString(),
      status: 'ok'
    };
  }

  /**
   * 流式预测接口 - 完全兼容old代码格式
   */
  @Post('predict_stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  async predictStream(@Body() req: PredictRequest, @Res() res: Response) {
    try {
      // 直接使用传入的messages，如果没有则使用默认的
      let messages = req.messages || [];
      
      // 如果没有传入messages，使用默认的系统消息
      if (messages.length === 0) {
        messages = [
          {
            role: 'system',
            content: '你是一个博客网站的助手，你可以自由调用JavaScript的API，然后以下是一些文章列表和ID你可以给',
          },
          {
            role: 'system',
            content: `解读用户需求【如果明确需要执行代码就不要输出其他文本】，你需要写JavaScript代码才能调用底层，你能调用的API不限于,你可以用run_js_code工具调用以下函数注意这里的函数是通过eval()调用需要你输出完整的调用链如baseAPIhandle.correctSong.handle('left')：${req.baseAPIHandler || ''}`,
          },
          { role: 'user', content: req.input_text },
        ];
      } else {
        // 如果有传入的messages，确保最后一条是用户输入
        const hasUserInput = messages.some(m => m.role === 'user' && m.content === req.input_text);
        if (!hasUserInput) {
          messages.push({ role: 'user', content: req.input_text });
        }
      }
      
      console.log('Messages:', JSON.stringify(messages, null, 2));
      console.log('baseAPIHandler:', req.baseAPIHandler);
      
      res.status(HttpStatus.OK);
      
      // 调用服务，传递所有参数
      const result = this.llmService.predictStream(
        req.input_text,
        req.app_config_id,
        messages,
        req.temperature || 0.3,
        req.max_tokens || 1000,
        req.baseAPIHandler
      );

      // 兼容old代码的返回格式
      for await (const chunk of result) {
        const data = {
          content: chunk.content || '',
          tool_calls: chunk.tool_calls || null,
        };
        res.write(`${JSON.stringify(data)}\n`);
      }
      res.end();
    } catch (err) {
      console.error('Error in predictStream:', err);
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 完整预测接口 - 兼容old代码格式
   */
  @Post('predict')
  async predict(@Body() req: PredictRequest) {
    try {
      // 直接使用传入的messages，如果没有则使用默认的
      let messages = req.messages || [];
      
      // 如果没有传入messages，使用默认的系统消息
      if (messages.length === 0) {
        messages = [
          {
            role: 'system',
            content: '你是一个博客网站的助手，你可以自由调用JavaScript的API，然后以下是一些文章列表和ID你可以给',
          },
          {
            role: 'system',
            content: `解读用户需求【如果明确需要执行代码就不要输出其他文本】，你需要写JavaScript代码才能调用底层，你能调用的API不限于,你可以用run_js_code工具调用以下函数注意这里的函数是通过eval()调用需要你输出完整的调用链如baseAPIhandle.correctSong.handle('left')：${req.baseAPIHandler || ''}`,
          },
          { role: 'user', content: req.input_text },
        ];
      } else {
        // 如果有传入的messages，确保最后一条是用户输入
        const hasUserInput = messages.some(m => m.role === 'user' && m.content === req.input_text);
        if (!hasUserInput) {
          messages.push({ role: 'user', content: req.input_text });
        }
      }

      // 兼容old代码的简单调用方式
      const response = await this.llmService.predictFull(
        req.input_text,
        req.app_config_id,
        messages,
        req.temperature || 0.3,
        req.max_tokens || 1000,
        req.baseAPIHandler
      );
      return response;
    } catch (err) {
      console.error('Error in predict:', err);
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取可用的AI模型配置
   */
  @Get('models')
  async getAvailableModels() {
    try {
      return await this.llmService.getAvailableAIModels();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取应用配置列表
   */
  @Get('apps')
  async getAppConfigs() {
    try {
      return await this.llmService.getAppConfigs();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 