/**
 * 书签安装落地页 HTML（内联样式，无外链依赖）。
 * website: https://www.roginx.ink
 */

/** 与收藏夹中一致的 javascript: 完整字符串（不含 HTML 转义） */
export function buildBookmarkletFullCode(scriptUrl: string): string {
  const safe =
    scriptUrl.indexOf("'") >= 0
      ? scriptUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      : scriptUrl;
  return `(function(){var u='${safe}';var s=document.createElement('script');s.charset='utf-8';s.src=u+(/\?/.test(u)?'&':'?')+'_='+Date.now();(document.body||document.head||document.documentElement).appendChild(s);void 0;})();`;
}

export function buildBookmarkletHref(scriptUrl: string): string {
  return 'javascript:' + buildBookmarkletFullCode(scriptUrl);
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

export function renderBookmarkLandingHtml(scriptUrl: string): string {
  const href = buildBookmarkletHref(scriptUrl);
  const hrefAttr = escapeHtmlAttr(href);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>形策二 · 书签</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#9aa8bc; --accent:#3d8bfd; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, "Segoe UI", "PingFang SC", sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; min-height: 100vh; }
    .wrap { max-width: 420px; margin: 0 auto; padding: 36px 20px 48px; }
    h1 { font-size: 1.2rem; font-weight: 600; margin: 0 0 20px; text-align: center; }
    p.step { margin: 0 0 14px; font-size: 0.95rem; color: var(--muted); }
    p.step strong { color: var(--text); }
    .card {
      background: var(--card); border-radius: 12px; padding: 18px; margin: 18px 0 22px;
      border: 1px solid rgba(255,255,255,.06);
    }
    a.bookmark-drag {
      display: block; text-align: center; padding: 16px 14px; border-radius: 10px;
      background: linear-gradient(145deg, #2b5278, #1e3a52); color: #fff !important; text-decoration: none; font-weight: 600;
      border: 2px dashed rgba(255,255,255,.22); cursor: grab; user-select: none;
    }
    a.bookmark-drag:active { cursor: grabbing; }
    a.bookmark-drag:hover { border-color: var(--accent); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>形策二 · 书签</h1>
    <p class="step">① 把下面按钮<strong>拖到书签栏</strong>（没有书签栏可按 <strong>Ctrl+Shift+B</strong> 显示，Mac：<strong>⌘+Shift+B</strong>）。</p>
    <div class="card">
      <a class="bookmark-drag" draggable="true" href="${hrefAttr}">形策二 · 自动答题</a>
    </div>
    <p class="step">② 进入<strong>考试页面</strong>后，<strong>点击</strong>该书签即可使用。</p>
  </div>
</body>
</html>`;
}
