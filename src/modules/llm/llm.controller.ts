import {
  Controller,
  Post,
  Body,
  Res,
  Header,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PredictRequest } from './predict.dto';
import { LLMService } from './llm.service';
import { Tools } from './tools';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';
import { Public } from '@/common/decorators/public.decorator';

@Controller("/llm")
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class LLMController {
  constructor(private readonly llmService: LLMService) {}

  /**
   * 模拟 /predict_stream
   * 通过 SSE (text/event-stream) 方式流式返回
   */
  @Post('predict_stream')
  @Public()
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  async predictStream(@Body() req: PredictRequest, @Res() res: Response) {
    try {
      // 构造消息
      let messages = [
        {
          role: 'system',
          content:
            '你是一个博客网站的助手，你可以自由调用JavaScript的API，然后以下是一些文章列表和ID你可以给',
        },
        {
          role: 'system',
          content: `解读用户需求【如果明确需要执行代码就不要输出其他文本】，你需要写JavaScript代码才能调用底层，你能调用的API不限于,你可以用run_js_code工具调用以下函数注意这里的函数是通过eval()调用需要你输出完整的调用链如baseAPIhandle.correctSong.handle('left')：${req.baseAPIHandler}`,
        },
        { role: 'user', content: req.input_text },
      ];
      if(req.messages) {
        messages = [...req.messages, ...messages ]
      }
      console.log(messages);
      
      res.status(HttpStatus.OK);
      
      const result = this.llmService.predictStream(messages, new Tools().tools);
      for await (const chunk of result) {
        const data = {
          content: chunk.content || '',
          tool_calls: chunk.tool_calls || null,
        };
        res.write(`${JSON.stringify(data)}\n`);
      }
      res.end();
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 模拟 /predict
   * 收集所有的流式片段，一次性返回 JSON
   */
  @Post('predict')
  @Public()
  async predict(@Body() req: PredictRequest) {
    try {
      const response = await this.llmService.predictFull(req.input_text);
      return response;
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}