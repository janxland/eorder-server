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

// DTO类
class PredictRequest {
  input_text: string;
  app_config_id?: number;
  messages?: any[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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
   * 流式预测接口
   */
  @Post('predict_stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  async predictStream(@Body() req: PredictRequest, @Res() res: Response) {
    try {
      res.status(HttpStatus.OK);
      
      const result = this.llmService.predictStream(
        req.input_text,
        req.app_config_id,
        req.messages,
        req.temperature,
        req.max_tokens
      );

      for await (const chunk of result) {
        const data = {
          content: chunk.content || '',
        };
        res.write(`${JSON.stringify(data)}\n`);
      }
      res.end();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 完整预测接口
   */
  @Post('predict')
  async predict(@Body() req: PredictRequest) {
    try {
      const response = await this.llmService.predictFull(
        req.input_text,
        req.app_config_id,
        req.messages,
        req.temperature,
        req.max_tokens
      );
      return response;
    } catch (err) {
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