/**
 * 书签落地页：JWT 登录 + LLM 配置
 *
 * 流程：
 *   1. 用户登录 → 获得 JWT Token（存 localStorage）
 *   2. 配置 LLM（API Key + Base URL + Model，存 localStorage）
 *   3. 拖拽书签到书签栏
 *   4. 任何网站点击书签 → 脚本从 localStorage 读取配置 → 调用 /llm/
 *   5. 首次调用验证 JWT → 创建域名会话缓存
 *   6. 后续同域名调用 → 命中缓存，跳过鉴权
 */

export interface BookmarkLandingOptions {
  /** 脚本 URL（无参数）*/
  scriptUrl: string
  /** 登录接口地址 */
  loginUrl: string
  /** LLM 代理网关地址 */
  llmProxyBase: string
  /** 书签按钮展示名 */
  bookmarkLabel?: string
}

/** LocalStorage key */
const LS = {
  TOKEN: 'llm_gw_token',
  API_KEY: 'llm_gw_api_key',
  BASE_URL: 'llm_gw_base_url',
  MODEL: 'llm_gw_model',
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;')
}

function escapeJsStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 生成书签：只嵌入脚本 URL，配置从 localStorage 读取 */
function buildBookmarkHref(scriptUrl: string): string {
  return 'javascript:(function(){var s=document.createElement("script");s.charset="utf-8";s.src="' + escapeJsStr(scriptUrl) + '?t=' + Date.now() + '";(document.head||document.documentElement).appendChild(s)})()'
}

export function renderBookmarkLandingHtml(opts: BookmarkLandingOptions): string {
  const loginUrl = opts.loginUrl.replace(/\/+$/, '')
  const llmProxyBase = opts.llmProxyBase.replace(/\/+$/, '')
  const btnText = opts.bookmarkLabel?.trim() || 'LLM 网关'
  const btnTitle = escapeHtmlAttr(btnText)
  const bookmarkHref = buildBookmarkHref(opts.scriptUrl)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${btnTitle}</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#9aa8bc; --accent:#3d8bfd; --ok:#3ecf8e; --err:#f87171; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); line-height:1.6; min-height:100vh; }
    .wrap { max-width:440px; margin:0 auto; padding:24px 16px 48px; }
    h1 { font-size:1.15rem; font-weight:600; margin:0 0 16px; text-align:center; }
    .card { background:var(--card); border-radius:12px; padding:16px; margin-bottom:14px; border:1px solid rgba(255,255,255,.06); }
    label { display:block; font-size:0.8rem; color:var(--muted); margin-bottom:6px; }
    input { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #334155; background:#0d1117; color:var(--text); font-size:0.9rem; margin-bottom:10px; }
    input:last-child { margin-bottom:0; }
    button { padding:10px 16px; border-radius:8px; border:none; font-size:0.88rem; cursor:pointer; background:var(--accent); color:#fff; font-weight:500; }
    button.secondary { background:#334155; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .hint { font-size:0.85rem; color:var(--muted); margin:0 0 14px; }
    .row { display:flex; gap:8px; }
    .row button { flex:1; }
    .msg { font-size:0.82rem; margin-top:10px; min-height:1.2em; }
    .msg.ok { color:var(--ok); }
    .msg.err { color:var(--err); }
    .bookmark {
      display:block; text-align:center; padding:14px; border-radius:10px;
      background:linear-gradient(145deg,#2b5278,#1e3a52); color:#fff !important;
      text-decoration:none; font-weight:600; border:2px dashed rgba(255,255,255,.25);
      cursor:grab; margin-top:8px;
    }
    .bookmark:hover { background:linear-gradient(145deg,#3a6a9a,#2a4a6a); }
    .bookmark.disabled { opacity:0.5; cursor:not-allowed; }
    .divider { border:none; border-top:1px solid rgba(255,255,255,.06); margin:16px 0; }
    .info { font-size:0.78rem; color:var(--muted); margin:8px 0; }
    .info code { background:#0d1117; padding:2px 6px; border-radius:4px; font-size:0.85em; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtmlAttr(btnText)}</h1>
    <p class="hint">登录后配置 LLM 参数，拖拽书签到收藏夹，即可在<strong>任意网站</strong>使用 AI。</p>

    <!-- 登录 -->
    <div class="card" id="loginCard">
      <label>用户名</label>
      <input type="text" id="username" placeholder="用户名" autocomplete="username">
      <label>密码</label>
      <input type="password" id="password" placeholder="密码" autocomplete="current-password">
      <div class="row" style="margin-top:12px;">
        <button id="btnLogin">登录</button>
      </div>
      <div class="msg" id="loginMsg"></div>
    </div>

    <!-- 已登录 -->
    <div class="card" id="loggedCard" style="display:none;">
      <label>JWT Token（已记住）</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <code id="tokenShow" style="flex:1;font-size:0.7rem;word-break:break-all;background:#0d1117;padding:8px;border-radius:6px;color:#94a3b8;"></code>
        <button class="secondary" id="btnLogout">退出</button>
      </div>
    </div>

    <hr class="divider">

    <!-- LLM 配置 -->
    <div class="card">
      <label>API Key（你自己的密钥）</label>
      <input type="password" id="apiKey" placeholder="sk-xxx" autocomplete="off">

      <label style="margin-top:10px;">Base URL</label>
      <input type="text" id="baseUrl" value="https://api.siliconflow.cn/v1" placeholder="https://api.openai.com/v1">

      <label style="margin-top:10px;">Model（可选）</label>
      <input type="text" id="model" placeholder="如 Qwen/Qwen2.5-7B-Instruct">

      <div class="row" style="margin-top:12px;">
        <button id="btnSave">保存配置</button>
        <button class="secondary" id="btnClear">清除</button>
      </div>
      <div class="msg" id="saveMsg"></div>
    </div>

    <!-- 书签 -->
    <p class="info">拖到收藏夹，在任何网站点击即可注入 AI 能力。首次调用需要鉴权，同网站后续调用<strong>自动跳过鉴权</strong>。</p>
    <a id="bookmark" class="bookmark disabled" href="${escapeHtmlAttr(bookmarkHref)}" title="${btnTitle}">${escapeHtmlAttr(btnText)}</a>
  </div>

<script>
(function(){
  // DOM
  var loginCard = document.getElementById('loginCard')
  var loggedCard = document.getElementById('loggedCard')
  var tokenShow = document.getElementById('tokenShow')
  var loginMsg = document.getElementById('loginMsg')
  var usernameInput = document.getElementById('username')
  var passwordInput = document.getElementById('password')
  var btnLogin = document.getElementById('btnLogin')
  var btnLogout = document.getElementById('btnLogout')
  var apiKeyInput = document.getElementById('apiKey')
  var baseUrlInput = document.getElementById('baseUrl')
  var modelInput = document.getElementById('model')
  var btnSave = document.getElementById('btnSave')
  var btnClear = document.getElementById('btnClear')
  var saveMsg = document.getElementById('saveMsg')
  var bookmark = document.getElementById('bookmark')

  function setMsg(el, text, ok) {
    el.textContent = text || ''
    el.className = 'msg' + (ok === true ? ' ok' : ok === false ? ' err' : '')
  }

  function updateLoginState() {
    var token = localStorage.getItem('${LS.TOKEN}') || ''
    if (token) {
      loginCard.style.display = 'none'
      loggedCard.style.display = 'block'
      tokenShow.textContent = token.substring(0, 40) + '...'
      checkReady()
    } else {
      loginCard.style.display = 'block'
      loggedCard.style.display = 'none'
      bookmark.className = 'bookmark disabled'
    }
  }

  function checkReady() {
    var token = localStorage.getItem('${LS.TOKEN}')
    var apiKey = localStorage.getItem('${LS.API_KEY}')
    if (token && apiKey) {
      bookmark.className = 'bookmark'
    } else {
      bookmark.className = 'bookmark disabled'
    }
  }

  function loadConfig() {
    try {
      if (localStorage.getItem('${LS.API_KEY}')) apiKeyInput.value = localStorage.getItem('${LS.API_KEY}')
      if (localStorage.getItem('${LS.BASE_URL}')) baseUrlInput.value = localStorage.getItem('${LS.BASE_URL}')
      if (localStorage.getItem('${LS.MODEL}')) modelInput.value = localStorage.getItem('${LS.MODEL}')
    } catch(e){}
    checkReady()
  }

  // 登录
  btnLogin.onclick = function() {
    var username = usernameInput.value.trim()
    var password = passwordInput.value
    if (!username || !password) { setMsg(loginMsg, '请填写用户名和密码', false); return }
    btnLogin.disabled = true
    setMsg(loginMsg, '登录中...', null)
    fetch('${escapeJsStr(loginUrl)}', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password})
    })
      .then(function(r){ return r.json().then(function(d){ return {res:r, data:d} }) })
      .then(function(ref){
        if (!ref.res.ok) throw new Error(ref.data.message || '登录失败')
        var token = ref.data.data && ref.data.data.token
        if (!token) throw new Error('未返回 token')
        localStorage.setItem('${LS.TOKEN}', token)
        updateLoginState()
        setMsg(loginMsg, '登录成功', true)
      })
      .catch(function(e){ setMsg(loginMsg, e.message || '登录失败', false) })
      .finally(function(){ btnLogin.disabled = false })
  }

  // 退出
  btnLogout.onclick = function() {
    localStorage.removeItem('${LS.TOKEN}')
    usernameInput.value = ''
    passwordInput.value = ''
    updateLoginState()
  }

  // 保存配置
  btnSave.onclick = function() {
    var apiKey = apiKeyInput.value.trim()
    var base = baseUrlInput.value.trim()
    var model = modelInput.value.trim()
    if (!apiKey) { setMsg(saveMsg, '请填写 API Key', false); return }
    try {
      localStorage.setItem('${LS.API_KEY}', apiKey)
      localStorage.setItem('${LS.BASE_URL}', base || 'https://api.siliconflow.cn/v1')
      localStorage.setItem('${LS.MODEL}', model)
      checkReady()
      setMsg(saveMsg, '已保存', true)
    } catch(e) { setMsg(saveMsg, '保存失败', false) }
  }

  // 清除
  btnClear.onclick = function() {
    try {
      localStorage.removeItem('${LS.API_KEY}')
      localStorage.removeItem('${LS.BASE_URL}')
      localStorage.removeItem('${LS.MODEL}')
      apiKeyInput.value = ''
      baseUrlInput.value = 'https://api.siliconflow.cn/v1'
      modelInput.value = ''
      checkReady()
      setMsg(saveMsg, '已清除', true)
    } catch(e) { setMsg(saveMsg, '清除失败', false) }
  }

  // 初始化
  loadConfig()
  updateLoginState()
})()
</script>
</body>
</html>`
}
