/**
 * 书签落地页：设备指纹（FingerprintJS）+ 许可证校验入口（与脚本侧共用逻辑）
 * website: https://www.roginx.ink
 */

export interface BookmarkLandingOptions {
  scriptUrl: string;
  /** cdn_list 主文件名，不含 .js */
  scriptBaseName: string;
  /** 站点对外 HTTPS 源，用于拼接 /api/cdn-script/license/verify */
  publicApiOrigin: string;
}

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

export function renderBookmarkLandingHtml(opts: BookmarkLandingOptions): string {
  const href = buildBookmarkletHref(opts.scriptUrl);
  const hrefAttr = escapeHtmlAttr(href);
  const verifyUrl = `${opts.publicApiOrigin.replace(/\/+$/, '')}/api/cdn-script/license/verify`;
  const verifyUrlJson = JSON.stringify(verifyUrl);
  const baseJson = JSON.stringify(opts.scriptBaseName);
  const lsKey = `roginx_cdn_license:${opts.scriptBaseName}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>脚本书签 · 授权</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#9aa8bc; --accent:#3d8bfd; --ok:#3ecf8e; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, "Segoe UI", "PingFang SC", sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
    .wrap { max-width: 440px; margin: 0 auto; padding: 28px 18px 40px; }
    h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 16px; text-align: center; }
    p.hint { margin: 0 0 14px; font-size: 0.88rem; color: var(--muted); }
    .card {
      background: var(--card); border-radius: 12px; padding: 14px 14px 16px;
      margin-bottom: 14px; border: 1px solid rgba(255,255,255,.06);
    }
    label { display:block; font-size: 0.78rem; color: var(--muted); margin-bottom: 6px; }
    input[type="password"], input[type="text"] {
      width: 100%; padding: 10px 11px; border-radius: 8px; border: 1px solid #334155;
      background: #0d1117; color: var(--text); font-size: 0.92rem;
    }
    .fp-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
    code#fpOut {
      flex:1; min-width:0; font-size:0.72rem; word-break:break-all;
      background:#0d1117; padding:8px 10px; border-radius:8px; color:#94a3b8;
    }
    button {
      padding: 10px 14px; border-radius: 8px; border: none; font-size: 0.88rem;
      cursor: pointer; background: var(--accent); color: #fff; font-weight: 500;
    }
    button.secondary { background: #334155; color: var(--text); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    a.bookmark-drag {
      display: block; text-align: center; padding: 14px 12px; border-radius: 10px;
      background: linear-gradient(145deg, #2b5278, #1e3a52); color: #fff !important;
      text-decoration: none; font-weight: 600; border: 2px dashed rgba(255,255,255,.22);
      cursor: grab; user-select: none; margin-top: 8px;
    }
    .step { font-size: 0.9rem; color: var(--muted); margin: 0 0 10px; }
    .step strong { color: var(--text); }
    #msg { font-size: 0.82rem; margin-top: 10px; min-height: 1.2em; }
    #msg.ok { color: var(--ok); }
    #msg.err { color: #f87171; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>脚本书签 · 授权</h1>
    <p class="hint">把<strong>设备指纹</strong>发给管理员签发密钥；在下面填入密钥并校验通过后，再到考试页运行书签。</p>

    <div class="card">
      <label>设备指纹（FingerprintJS visitorId）</label>
      <div class="fp-row">
        <code id="fpOut">加载中…</code>
        <button type="button" class="secondary" id="btnCopyFp" disabled>复制指纹</button>
      </div>
      <label for="lic">授权密钥（管理员下发）</label>
      <input type="password" id="lic" autocomplete="off" placeholder="粘贴 64 位十六进制密钥" />
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button type="button" id="btnVerify">校验并记住（本站）</button>
      </div>
      <div id="msg"></div>
    </div>

    <p class="step">① 把按钮<strong>拖到书签栏</strong>（<kbd style="background:#1e293b;padding:2px 6px;border-radius:4px;font-size:0.85em;">Ctrl+Shift+B</kbd> 显示书签栏）。</p>
    <div class="card" style="margin-bottom:12px;">
      <a class="bookmark-drag" draggable="true" href="${hrefAttr}">形策脚本 · 书签</a>
    </div>
    <p class="step">② 打开<strong>考试页</strong>后点击书签；首次会要求输入<strong>同一密钥</strong>（通过校验后会记在浏览器）。</p>
  </div>
  <script>
(function () {
    var VERIFY_URL = ${verifyUrlJson};
    var BASE_NAME = ${baseJson};
    var LS = ${JSON.stringify(lsKey)};
    var fpOut = document.getElementById('fpOut');
    var btnCopyFp = document.getElementById('btnCopyFp');
    var btnVerify = document.getElementById('btnVerify');
    var licInput = document.getElementById('lic');
    var msg = document.getElementById('msg');
    var visitorId = '';
    function setMsg(text, ok) {
      msg.textContent = text || '';
      msg.className = ok === true ? 'ok' : ok === false ? 'err' : '';
    }
    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.async = true;
        s.onload = resolve;
        s.onerror = function () {
          reject(new Error('指纹脚本加载失败'));
        };
        s.src = src;
        document.head.appendChild(s);
      });
    }
    loadScript('https://openfpcdn.io/fingerprintjs/v4/iife.min.js')
      .then(function () {
        if (typeof FingerprintJS === 'undefined') throw new Error('FingerprintJS 未就绪');
        return FingerprintJS.load();
      })
      .then(function (fp) {
        return fp.get();
      })
      .then(function (r) {
        visitorId = r.visitorId;
        fpOut.textContent = visitorId;
        btnCopyFp.disabled = false;
      })
      .catch(function (e) {
        fpOut.textContent = '指纹加载失败';
        setMsg(e && e.message ? e.message : String(e), false);
      });
    btnCopyFp.addEventListener('click', function () {
      if (!visitorId) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(visitorId).then(function () {
          setMsg('指纹已复制', true);
        }).catch(function () {
          setMsg('复制失败，请手动选中指纹', false);
        });
      } else setMsg('浏览器不支持一键复制', false);
    });
    btnVerify.addEventListener('click', function () {
      var licenseKey = (licInput.value || '').trim();
      if (!visitorId || !licenseKey) {
        setMsg('请等待指纹就绪并填写密钥', false);
        return;
      }
      btnVerify.disabled = true;
      setMsg('校验中…', undefined);
      fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: visitorId,
          licenseKey: licenseKey,
          baseName: BASE_NAME,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { res: res, data: data };
          });
        })
        .then(function (_ref) {
          if (!_ref.res.ok) {
            var m =
              _ref.data.message ||
              (_ref.data.data && _ref.data.data.message) ||
              '校验失败';
            throw new Error(typeof m === 'string' ? m : '校验失败');
          }
          try {
            localStorage.setItem(LS, licenseKey);
          } catch (_) {}
          setMsg('校验通过。考试页书签首次仍会询问密钥，请输入相同密钥。', true);
        })
        .catch(function (e) {
          setMsg(e.message || '校验失败', false);
        })
        .finally(function () {
          btnVerify.disabled = false;
        });
    });
})();
  </script>
</body>
</html>`;
}
