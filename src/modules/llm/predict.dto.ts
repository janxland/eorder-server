import { IsOptional, IsString, IsArray, IsNumber } from 'class-validator';

/**
 * PredictRequest —— OpenAI Chat Completions 兼容透传 body
 *
 * 后端不再做任何 prompt 拼装，前端 AgentRuntime/Skill 全权负责：
 *  - messages 数组 (含 system/user/assistant/tool 全部历史)
 *  - tools 必须是 OpenAI 规范 `{type:'function', function:{name,description,parameters}}`
 *  - tool_choice / stop / penalty / max_tokens 等控制项都由前端按需注入
 *
 * 注意：DTO 仅做必要校验，其余字段以扩展属性 ([key:string]) 形式透传给上游。
 */
export class PredictRequest {
  @IsArray()
  messages: Array<any>;

  @IsOptional()
  @IsArray()
  tools?: Array<any>;

  /** 'none' | 'auto' | 'required' | {type:'function', function:{name}} */
  @IsOptional()
  tool_choice?: any;

  @IsOptional()
  parallel_tool_calls?: boolean;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  top_p?: number;

  @IsOptional()
  @IsNumber()
  max_tokens?: number;

  @IsOptional()
  @IsNumber()
  frequency_penalty?: number;

  @IsOptional()
  @IsNumber()
  presence_penalty?: number;

  /** string | string[] */
  @IsOptional()
  stop?: any;

  /** 任意额外 OpenAI 兼容字段 (response_format / seed / n / ...) 直接透传 */
  [key: string]: any;
}
