/**
 * 极简 User-Agent 解析器：只识别浏览器 + 操作系统，零外部依赖
 * 用于在会话管理 UI 上展示友好的设备名称
 */
export class DeviceParser {
  private static readonly BROWSER_PATTERNS: Array<[RegExp, string]> = [
    [/Edg\//i, 'Edge'],
    [/OPR\//i, 'Opera'],
    [/Chrome\//i, 'Chrome'],
    [/Firefox\//i, 'Firefox'],
    [/Safari\//i, 'Safari'],
    [/MSIE |Trident\//i, 'IE'],
  ];

  private static readonly OS_PATTERNS: Array<[RegExp, string]> = [
    [/Windows NT 10/i, 'Windows 10/11'],
    [/Windows NT/i, 'Windows'],
    [/Mac OS X/i, 'macOS'],
    [/Android/i, 'Android'],
    [/iPhone|iPad|iOS/i, 'iOS'],
    [/Linux/i, 'Linux'],
  ];

  static parse(ua?: string): string {
    if (!ua) return 'Unknown Device';
    const browser = this.match(ua, this.BROWSER_PATTERNS) ?? 'Unknown Browser';
    const os = this.match(ua, this.OS_PATTERNS) ?? 'Unknown OS';
    return `${browser} on ${os}`;
  }

  private static match(ua: string, patterns: Array<[RegExp, string]>): string | null {
    for (const [reg, label] of patterns) {
      if (reg.test(ua)) return label;
    }
    return null;
  }
}
