/**
 * 对外提供 cdn_list 下的外链脚本；路径与仓库内文件名一一对应（仅 basename，不含 .js）。
 * website: https://www.roginx.ink
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/** 仅允许与仓库中脚本文件名一致的安全字符，禁止 ..、斜杠等 */
const SAFE_BASENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;

@Injectable()
export class CdnScriptService {
  private assertSafeBaseName(baseName: string): void {
    if (!SAFE_BASENAME.test(baseName)) {
      throw new BadRequestException('脚本名称不合法，请使用与 cdn_list 下文件名一致的主名（不含 .js）');
    }
  }

  /** 解析 cdn_list 目录或 ncc 打平后的候选根路径 */
  private cdnListRoots(): string[] {
    return [
      path.join(__dirname, '..', '..', '..', 'cdn_list'),
      path.join(__dirname, '..', '..', 'cdn_list'),
      path.join(process.cwd(), 'dist', 'cdn_list'),
      path.join(process.cwd(), 'cdn_list'),
    ];
  }

  /**
   * @param baseName 不含扩展名，须与 src/cdn_list 内某 .js 文件主名一致，例如 yxy2_20260430
   */
  getScriptByBaseName(baseName: string): string {
    this.assertSafeBaseName(baseName);
    const fileName = `${baseName}.js`;

    for (const root of this.cdnListRoots()) {
      const full = path.join(root, fileName);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return fs.readFileSync(full, 'utf-8');
      }
    }

    const flat = path.join(__dirname, fileName);
    if (fs.existsSync(flat) && fs.statSync(flat).isFile()) {
      return fs.readFileSync(flat, 'utf-8');
    }

    throw new NotFoundException(`未找到脚本: ${fileName}（请将文件放在 cdn_list 目录）`);
  }
}
