import { Injectable } from '@nestjs/common';

// 定义工具的接口
interface Tool {
  name: string;
  description: string;
  required_parameters: string[];
  parameters: Record<string, any>;
}

@Injectable()
export class Tools {
  // 用来存放所有工具的数组
  public tools: Tool[] = [];

  constructor() {
    // 注册 NULLTools 工具
    this.register(
      'NULLTools',
      '防止出现工具错误，无任何内容的工具，当agent发现没有可以调用的工具调用这个',
      [],
      {},
    );

    // 注册 run_js_code 工具
    this.register(
      'run_js_code',
      '在浏览器执行一段JS代码',
      ['code'],
      {
        code: { type: 'string', description: '要执行的JavaScript代码' },
      },
    );
  }

  /**
   * 注册一个工具
   */
  register(
    name: string,
    description: string,
    required_parameters: string[],
    parameters: Record<string, any>,
  ) {
    // 检查工具名称是否已存在
    if (this.tools.some(tool => tool.name === name)) {
      throw new Error(`Tool with name "${name}" already exists`);
    }

    // 验证参数
    if (!Array.isArray(required_parameters)) {
      throw new Error('required_parameters must be an array');
    }

    if (typeof parameters !== 'object' || parameters === null) {
      throw new Error('parameters must be an object');
    }

    // 添加工具到数组
    this.tools.push({
      name,
      description,
      required_parameters,
      parameters,
    });
  }

  /**
   * 根据工具名称查找工具
   */
  findTool(name: string): Tool | undefined {
    return this.tools.find(tool => tool.name === name);
  }
}
