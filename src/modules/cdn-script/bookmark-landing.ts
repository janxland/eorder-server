/**
 * 书签落地页：JWT 登录 + 服务端 LLM 配置 + 凭据注入任意页面（带 localStorage 兜底）
 *
 * 流程：
 *   1. 登录（POST /auth-center/login）→ 拿到 JWT accessToken（存 localStorage）
 *   2. 拉取用户已保存的 LLM 配置（GET /api/cdn/config）→ 选择一个，或手动填写
 *   3. 生成书签：把 JWT + 选中配置（apiKey/baseUrl/model）用 base64 编码进 javascript: URL
 *   4. 在任意网站点击书签 → 书签按以下顺序解析配置（任一层有效即用，并回写 localStorage）：
 *        ① 嵌入的 base64 配置（主路径）
 *        ② localStorage 的 llm_gw_cfg blob（上次点击写入，兜底1）
 *        ③ 散落的 page_agent_hierarchical_* / llm_gw_* key（兜底2）
 *      生效后：
 *        - window.__LLM_GW__ 暴露 {token, apiKey, baseUrl, model, ...}（供脚本走网关鉴权）
 *        - localStorage 注入配置（含 page_agent_hierarchical_* key，现有 cdn_list 脚本直接复用）
 *        - 动态加载脚本 → 脚本即被鉴权与可用
 *
 * 关键点：
 *   - 凭据不依赖落地页 origin 的 localStorage（跨域读不到），而是编码进书签本身，
 *     由书签在目标页上下文里就地写入。
 *   - 即便书签嵌入层失效（base64 损坏 / 字段缺失 / 旧书签），同站点的 localStorage 缓存
 *     仍可兜底，脚本不至于直接不可用。
 */

export interface BookmarkLandingOptions {
  /** 脚本完整 URL（无 query），如 https://xqjn.top/api/cdn-script/page_agent_hierarchical */
  scriptUrl: string;
  /** 脚本主名（不含 .js），如 page_agent_hierarchical */
  scriptBaseName: string;
  /** 对外 API origin，如 https://xqjn.top */
  publicApiOrigin: string;
  /** 书签按钮展示名 */
  bookmarkLabel?: string;
}

/** LocalStorage key（落地页自身记忆态 + 书签运行时持久化缓存）*/
const LS = {
  TOKEN: 'llm_gw_token',
  SEL: 'llm_gw_selected_config',
  API_KEY: 'llm_gw_api_key',
  BASE_URL: 'llm_gw_base_url',
  MODEL: 'llm_gw_model',
  /** 书签运行时写入的完整配置 blob：嵌入层失效时作为兜底缓存 */
  CFG: 'llm_gw_cfg',
};

/**
 * cdn_list/page_agent_hierarchical.js 读取的 localStorage key。
 * 书签在目标页注入这些 key，现有脚本无需改动即可拿到配置。
 */
const PA_KEYS = {
  API_KEY: 'page_agent_hierarchical_api_key',
  BASE_URL: 'page_agent_hierarchical_base_url',
  MODEL: 'page_agent_hierarchical_model',
};

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function escapeJsStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function renderBookmarkLandingHtml(opts: BookmarkLandingOptions): string {
  const origin = opts.publicApiOrigin.replace(/\/+$/, '');
  const scriptUrl = opts.scriptUrl.replace(/\/+$/, '');
  const scriptBaseName = opts.scriptBaseName || '';
  const loginUrl = `${origin}/auth-center/login`;
  const configUrl = `${origin}/api/cdn/config`;
  const btnText = opts.bookmarkLabel?.trim() || 'LLM 网关';
  const btnTitle = escapeHtmlAttr(btnText);

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
    .wrap { max-width:460px; margin:0 auto; padding:24px 16px 48px; }
    h1 { font-size:1.15rem; font-weight:600; margin:0 0 16px; text-align:center; }
    .card { background:var(--card); border-radius:12px; padding:16px; margin-bottom:14px; border:1px solid rgba(255,255,255,.06); }
    label { display:block; font-size:0.8rem; color:var(--muted); margin-bottom:6px; }
    input[type=text], input[type=password] { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #334155; background:#0d1117; color:var(--text); font-size:0.9rem; margin-bottom:10px; }
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
      cursor:grab; margin-top:8px; user-select:none;
    }
    .bookmark:hover { background:linear-gradient(145deg,#3a6a9a,#2a4a6a); }
    .bookmark.disabled { opacity:0.5; cursor:not-allowed; background:#2a3340; }
    .divider { border:none; border-top:1px solid rgba(255,255,255,.06); margin:16px 0; }
    .info { font-size:0.78rem; color:var(--muted); margin:8px 0; line-height:1.7; }
    .info code { background:#0d1117; padding:2px 6px; border-radius:4px; font-size:0.85em; }
    .cfg-item { display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid #334155; margin-bottom:8px; cursor:pointer; background:#0d1117; }
    .cfg-item:hover { border-color:var(--accent); }
    .cfg-item input[type=radio] { margin-top:3px; }
    .cfg-item .meta { flex:1; min-width:0; }
    .cfg-item .name { font-size:0.88rem; font-weight:500; }
    .cfg-item .sub { font-size:0.72rem; color:var(--muted); word-break:break-all; }
    .cfg-item .badge { font-size:0.66rem; padding:1px 6px; border-radius:4px; background:#1f3a5f; color:#9bc1ff; margin-left:6px; }
    .loading { font-size:0.8rem; color:var(--muted); padding:8px 0; }
    .tag { display:inline-block; font-size:0.68rem; padding:1px 6px; border-radius:4px; background:#243244; color:var(--muted); margin-left:6px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtmlAttr(btnText)}</h1>
    <p class="hint">登录后选择已有 LLM 配置，拖拽书签到收藏夹，即可在<strong>任意网站</strong>注入 AI 能力（JWT + 模型配置随书签下发）。</p>

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
      <label>JWT Token（已记住，6 小时有效）<span class="tag">用于脚本鉴权</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <code id="tokenShow" style="flex:1;font-size:0.7rem;word-break:break-all;background:#0d1117;padding:8px;border-radius:6px;color:#94a3b8;"></code>
        <button class="secondary" id="btnLogout">退出</button>
      </div>
    </div>

    <hr class="divider">

    <!-- 服务端已有配置 -->
    <div class="card">
      <label>已有 LLM 配置 <span class="tag" id="cfgCount"></span></label>
      <div id="configList"><div class="loading">登录后自动拉取…</div></div>
      <button class="secondary" id="btnRefresh" style="margin-top:6px;display:none;">重新拉取</button>
    </div>

    <!-- 自定义配置 -->
    <div class="card">
      <label><input type="radio" name="cfgsrc" value="manual" id="srcManual"> 自定义配置 <span class="tag">未保存或临时覆盖</span></label>
      <label style="margin-top:10px;">API Key（你自己的密钥）</label>
      <input type="password" id="apiKey" placeholder="sk-xxx" autocomplete="off">
      <label style="margin-top:10px;">Base URL</label>
      <input type="text" id="baseUrl" value="https://api.siliconflow.cn/v1" placeholder="https://api.openai.com/v1">
      <label style="margin-top:10px;">Model（可选）</label>
      <input type="text" id="model" placeholder="如 Qwen/Qwen2.5-7B-Instruct">
      <div class="msg" id="saveMsg"></div>
    </div>

    <!-- 书签 -->
    <p class="info">
      拖到收藏夹，在任何网站点击即可注入 <code>JWT</code> + <code>LLM 配置</code>，脚本会自动鉴权并加载。
      <br>书签把凭据编码在自身内部（不依赖落地页 localStorage），因此<strong>任意页面</strong>都能用。
      <br>Token 6 小时过期，过期后回到本页登录并重新拖拽书签。
      <br>首次点击会把配置写入当前页 <code>localStorage</code>，即便书签嵌入层失效，同站点下次点击也能用本地缓存兜底。
    </p>
    <a id="bookmark" class="bookmark disabled" href="#" title="${btnTitle}">${escapeHtmlAttr(btnText)}</a>
  </div>

<script>
(function(){
  // === 服务端注入常量 ===
  var SCRIPT_URL = '${escapeJsStr(scriptUrl)}';
  var SCRIPT_BASE = '${escapeJsStr(scriptBaseName)}';
  var ORIGIN = '${escapeJsStr(origin)}';
  var LOGIN_URL = '${escapeJsStr(loginUrl)}';
  var CONFIG_URL = '${escapeJsStr(configUrl)}';
  var LS = { token:'${LS.TOKEN}', sel:'${LS.SEL}', apiKey:'${LS.API_KEY}', baseUrl:'${LS.BASE_URL}', model:'${LS.MODEL}', cfg:'${LS.CFG}' };
  var PA_KEYS = { apiKey:'${PA_KEYS.API_KEY}', baseUrl:'${PA_KEYS.BASE_URL}', model:'${PA_KEYS.MODEL}' };

  // === DOM ===
  var loginCard = document.getElementById('loginCard');
  var loggedCard = document.getElementById('loggedCard');
  var tokenShow = document.getElementById('tokenShow');
  var loginMsg = document.getElementById('loginMsg');
  var usernameInput = document.getElementById('username');
  var passwordInput = document.getElementById('password');
  var btnLogin = document.getElementById('btnLogin');
  var btnLogout = document.getElementById('btnLogout');
  var configList = document.getElementById('configList');
  var cfgCount = document.getElementById('cfgCount');
  var btnRefresh = document.getElementById('btnRefresh');
  var apiKeyInput = document.getElementById('apiKey');
  var baseUrlInput = document.getElementById('baseUrl');
  var modelInput = document.getElementById('model');
  var srcManual = document.getElementById('srcManual');
  var saveMsg = document.getElementById('saveMsg');
  var bookmark = document.getElementById('bookmark');

  // === 状态 ===
  var serverConfigs = [];

  function setMsg(el, text, ok) {
    el.textContent = text || '';
    el.className = 'msg' + (ok === true ? ' ok' : ok === false ? ' err' : '');
  }

  // 浏览器侧 HTML 属性转义（服务端的 escapeHtmlAttr 不可用）
  function escAttr(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');
  }

  function getToken() { try { return localStorage.getItem(LS.token) || ''; } catch(e){ return ''; } }

  // UTF-8 安全 base64（编码 / 解码互逆，保证中文等不乱码）
  function utf8ToBase64(str) {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(m, p) {
        return String.fromCharCode(parseInt(p, 16));
      }));
    } catch (e) { return ''; }
  }

  // 生成 javascript: 书签 URL：把 cfg 编码进 base64，运行时解码并注入。
  // 运行时解析顺序：① 嵌入的 base64 配置（主） -> ② localStorage 的 llm_gw_cfg blob（兜底1）
  //   -> ③ 散落的 page_agent_* / llm_gw_* key（兜底2）。
  // 任意一层拿到合法配置即写入 localStorage 持久化，保证「书签失效也不至于无配置可用」。
  function makeBookmarklet(cfg) {
    var b64 = utf8ToBase64(JSON.stringify(cfg));
    if (!b64) return '';
    var fbUrl = (cfg.scriptUrl || '').replace(/'/g, "\\'");
    var body =
      "var B64='" + b64 + "';" +
      "var FB_URL='" + fbUrl + "';" +
      "var K={tok:'" + LS.token + "',ak:'" + LS.apiKey + "',bu:'" + LS.baseUrl + "',mo:'" + LS.model + "'," +
        "pak:'" + PA_KEYS.apiKey + "',pbu:'" + PA_KEYS.baseUrl + "',pmo:'" + PA_KEYS.model + "',cfg:'" + LS.cfg + "'};" +
      // 工具：localStorage 读写 + base64 解码 + JSON 解析 + 配置校验
      "function lg(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}" +
      "function ls(k,v){try{localStorage.setItem(k,v)}catch(e){}}" +
      "function dec(b){try{return JSON.parse(decodeURIComponent(atob(b).split('').map(function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)}).join('')))}catch(e){return null}}" +
      "function jn(s){try{return JSON.parse(s)}catch(e){return null}}" +
      "function ok(c){return c&&c.token&&c.apiKey&&c.baseUrl}" +
      // ① 主路径：解码书签内嵌配置（base64）
      "var c=dec(B64);" +
      // ② 兜底1：上次点击写入的完整 blob（localStorage 里是明文 JSON，直接 JSON.parse）
      "if(!ok(c)){var b=jn(lg(K.cfg));if(ok(b)){c=b;console.warn('[LLM-GW] 嵌入配置失效，使用本地缓存 blob')}}" +
      // ③ 兜底2：散落的 page_agent_* / llm_gw_* key
      "if(!ok(c)){c={token:lg(K.tok),apiKey:lg(K.pak)||lg(K.ak),baseUrl:lg(K.pbu)||lg(K.bu),model:lg(K.pmo)||lg(K.mo),scriptUrl:FB_URL};if(ok(c))console.warn('[LLM-GW] 嵌入配置失效，使用散落 key 兜底')}" +
      "if(!ok(c)){console.error('[LLM-GW] 配置缺失：请回到落地页登录并重新拖拽书签');return}" +
      // 持久化：把生效配置回写 localStorage（含 page_agent_* key，现有 cdn_list 脚本直接复用）
      "ls(K.cfg,JSON.stringify({token:c.token,apiKey:c.apiKey,baseUrl:c.baseUrl,model:c.model||'',scriptUrl:c.scriptUrl||FB_URL}));" +
      "ls(K.tok,c.token);ls(K.ak,c.apiKey);ls(K.bu,c.baseUrl);ls(K.mo,c.model||'');" +
      "ls(K.pak,c.apiKey);ls(K.pbu,c.baseUrl);ls(K.pmo,c.model||'');" +
      // 全局暴露：供脚本走网关鉴权 / 任意读取
      "window.__LLM_GW__={token:c.token,apiKey:c.apiKey,baseUrl:c.baseUrl,baseURL:c.baseUrl,model:c.model||'',llmProxyBase:c.llmProxyBase||'',scriptUrl:c.scriptUrl||FB_URL};" +
      // 加载脚本（目标页上下文里读取上面的注入）
      "var s=document.createElement('script');" +
      "s.charset='utf-8';" +
      "s.src=(c.scriptUrl||FB_URL)+'?t='+Date.now();" +
      "(document.head||document.documentElement).appendChild(s);";
    return 'javascript:(function(){' + body + '})()';
  }

  function findConfig(id) {
    for (var i = 0; i < serverConfigs.length; i++) {
      if (String(serverConfigs[i].id) === String(id)) return serverConfigs[i];
    }
    return null;
  }

  function getSelectedSource() {
    var radios = document.getElementsByName('cfgsrc');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return radios[i].value; // 'server:<id>' | 'manual'
    }
    return '';
  }

  // 当前生效的配置（apiKey/baseUrl/model）+ 来源
  function activeConfig() {
    var sel = getSelectedSource();
    if (sel && sel.indexOf('server:') === 0) {
      var c = findConfig(sel.slice(7));
      if (c) return { source:'server', apiKey:c.apiKey, baseUrl:c.baseUrl, model:c.model||'' };
    }
    return {
      source:'manual',
      apiKey: apiKeyInput.value.trim(),
      baseUrl: (baseUrlInput.value.trim() || 'https://api.siliconflow.cn/v1'),
      model: modelInput.value.trim()
    };
  }

  // 根据当前登录态 + 选中配置，重建书签 href
  function updateBookmark() {
    var token = getToken();
    var ac = activeConfig();
    var ready = !!(token && ac.apiKey && ac.baseUrl);
    if (!ready) {
      bookmark.href = '#';
      bookmark.className = 'bookmark disabled';
      bookmark.removeAttribute('draggable');
      return;
    }
    // 嵌入书签的配置：JWT + 选中 LLM 配置 + 脚本/网关地址。
    // scriptBaseName/configs 不参与运行时，剔除以压缩书签体积。
    var cfg = {
      token: token,
      apiKey: ac.apiKey,
      baseUrl: ac.baseUrl,
      model: ac.model,
      llmProxyBase: ORIGIN,
      scriptUrl: SCRIPT_URL,
    };
    var href = makeBookmarklet(cfg);
    if (!href) {
      bookmark.href = '#';
      bookmark.className = 'bookmark disabled';
      bookmark.removeAttribute('draggable');
      return;
    }
    bookmark.href = href;
    bookmark.className = 'bookmark';
    bookmark.setAttribute('draggable', 'true');
  }

  function selectSource(val) {
    var radios = document.getElementsByName('cfgsrc');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = (radios[i].value === val);
    }
    updateBookmark();
  }

  function renderConfigs() {
    cfgCount.textContent = serverConfigs.length ? (serverConfigs.length + ' 个') : '无';
    if (!serverConfigs.length) {
      configList.innerHTML = '<div class="loading">暂无已保存配置，可在下方手动填写。</div>';
      btnRefresh.style.display = 'inline-block';
      selectSource('manual');
      return;
    }
    btnRefresh.style.display = 'inline-block';
    var html = '';
    serverConfigs.forEach(function(c) {
      var val = 'server:' + c.id;
      html += '<label class="cfg-item">' +
        '<input type="radio" name="cfgsrc" value="' + escAttr(val) + '">' +
        '<div class="meta">' +
          '<div class="name">' + escAttr(c.name || '未命名') + (c.isDefault ? '<span class="badge">默认</span>' : '') + '</div>' +
          '<div class="sub">' + escAttr(c.baseUrl || '') + (c.model ? ' · ' + escAttr(c.model) : '') + '</div>' +
        '</div>' +
      '</label>';
    });
    configList.innerHTML = html;
    // 默认选中 isDefault，否则第一个
    var preferred = null;
    for (var i = 0; i < serverConfigs.length; i++) {
      if (serverConfigs[i].isDefault) { preferred = serverConfigs[i]; break; }
    }
    if (!preferred) preferred = serverConfigs[0];
    // 记忆上次选择
    var mem = '';
    try { mem = localStorage.getItem(LS.sel) || ''; } catch(e){}
    var useVal = (mem && mem.indexOf('server:') === 0 && findConfig(mem.slice(7))) ? mem : ('server:' + preferred.id);
    selectSource(useVal);
    // 绑定 radio change
    var radios = document.getElementsByName('cfgsrc');
    for (var i = 0; i < radios.length; i++) {
      radios[i].onchange = function() {
        try { localStorage.setItem(LS.sel, getSelectedSource()); } catch(e){}
        updateBookmark();
      };
    }
  }

  function fetchConfigs() {
    var token = getToken();
    if (!token) return;
    configList.innerHTML = '<div class="loading">拉取中…</div>';
    fetch(CONFIG_URL, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) {
        if (r.status === 401) throw new Error('登录已过期');
        return r.json().then(function(d) { return { res:r, data:d }; });
      })
      .then(function(ref) {
        if (!ref.res.ok) throw new Error((ref.data && (ref.data.message || ref.data.error)) || '拉取失败');
        var list = (ref.data && ref.data.data) || ref.data || [];
        serverConfigs = Array.isArray(list) ? list : [];
        renderConfigs();
      })
      .catch(function(e) {
        cfgCount.textContent = '';
        configList.innerHTML = '<div class="loading" style="color:var(--err);">' + (e.message || '拉取失败') + '</div>';
        btnRefresh.style.display = 'inline-block';
        selectSource('manual');
      });
  }

  function updateLoginState() {
    var token = getToken();
    if (token) {
      loginCard.style.display = 'none';
      loggedCard.style.display = 'block';
      tokenShow.textContent = token.substring(0, 32) + '…';
      fetchConfigs();
    } else {
      loginCard.style.display = 'block';
      loggedCard.style.display = 'none';
      serverConfigs = [];
      cfgCount.textContent = '';
      configList.innerHTML = '<div class="loading">登录后自动拉取…</div>';
      btnRefresh.style.display = 'none';
      selectSource('manual');
    }
    updateBookmark();
  }

  // === 登录 ===
  btnLogin.onclick = function() {
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    if (!username || !password) { setMsg(loginMsg, '请填写用户名和密码', false); return; }
    btnLogin.disabled = true;
    setMsg(loginMsg, '登录中…', null);
    fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function(r) { return r.json().then(function(d) { return { res:r, data:d }; }); })
      .then(function(ref) {
        if (!ref.res.ok || !ref.data || ref.data.success === false) {
          throw new Error((ref.data && (ref.data.message || ref.data.error)) || '登录失败');
        }
        var d = ref.data.data || ref.data;
        var token = d.accessToken || d.token;
        if (!token) throw new Error('未返回 accessToken');
        try { localStorage.setItem(LS.token, token); } catch(e){}
        updateLoginState();
        setMsg(loginMsg, '登录成功', true);
      })
      .catch(function(e) { setMsg(loginMsg, e.message || '登录失败', false); })
      .finally(function() { btnLogin.disabled = false; });
  };

  // === 退出 ===
  btnLogout.onclick = function() {
    try { localStorage.removeItem(LS.token); localStorage.removeItem(LS.sel); } catch(e){}
    usernameInput.value = '';
    passwordInput.value = '';
    updateLoginState();
  };

  // === 重新拉取 ===
  btnRefresh.onclick = function() { fetchConfigs(); };

  // === 自定义配置 ===
  function loadManual() {
    try {
      if (localStorage.getItem(LS.apiKey)) apiKeyInput.value = localStorage.getItem(LS.apiKey);
      if (localStorage.getItem(LS.baseUrl)) baseUrlInput.value = localStorage.getItem(LS.baseUrl);
      if (localStorage.getItem(LS.model)) modelInput.value = localStorage.getItem(LS.model);
    } catch(e){}
  }

  srcManual.onclick = function() {
    selectSource('manual');
    updateBookmark();
  };
  apiKeyInput.oninput = baseUrlInput.oninput = modelInput.oninput = function() {
    try {
      localStorage.setItem(LS.apiKey, apiKeyInput.value.trim());
      localStorage.setItem(LS.baseUrl, baseUrlInput.value.trim());
      localStorage.setItem(LS.model, modelInput.value.trim());
    } catch(e){}
    if (getSelectedSource() === 'manual') updateBookmark();
  };

  // === 初始化 ===
  loadManual();
  updateLoginState();
})();
</script>
</body>
</html>`;
}
