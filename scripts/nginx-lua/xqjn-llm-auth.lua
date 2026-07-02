--[[
  xqjn-llm-auth.lua
  Nginx Lua：JWT 鉴权 + 域名级会话缓存

  部署路径：/www/server/panel/vhost/nginx/lua/xqjn-llm-auth.lua

  架构：
    xqjn.top (强服务器) → 鉴权 → 代理到 edu.roginx.ink/api/llm/
                                             ↓
                                      eorder-server 处理 LLM 调用

  核心设计：域名级会话缓存
    - 首次调用：验证 JWT → 写入 Redis 缓存 llm_session:{origin}:{userId}
    - 后续调用（同域名）：检查缓存存在 → 直接放行
    - TTL：24小时（可配置）
]]

local var    = ngx.var
local req    = ngx.req
local log    = ngx.log
local WARN   = ngx.WARN
local HTTP_NO_CONTENT = 204

-- ============================================================
-- 配置
-- ============================================================
local CONF = {
    redis_host       = "127.0.0.1",
    redis_port       = 6379,
    redis_db         = 0,
    redis_timeout    = 200,
    jwt_secret       = os.getenv("LLM_PROXY_JWT_SECRET") or "change-me-in-production",
    -- 代理到 eorder-server
    upstream_server  = "http://127.0.0.1:3000",
    -- 会话缓存 TTL（秒）
    session_ttl      = tonumber(os.getenv("LLM_SESSION_TTL")) or 86400,
    -- 速率限制（0 = 不限）
    rate_limit       = 0,
}

-- ============================================================
-- 工具函数
-- ============================================================

local function _log(prefix, msg)
    log(WARN, "[llm-auth] " .. prefix .. ": " .. msg)
end

local function get_header(key)
    return var["http_" .. key]
end

local function base64url_decode(data)
    data = data:gsub("-", "+"):gsub("_", "/")
    local pad = #data % 4
    if pad > 0 then data = data .. string.rep("=", 4 - pad) end
    return ngx.decode_base64(data)
end

local function verify_jwt(token)
    local parts = {}
    for part in token:gmatch("[^%.]+") do
        table.insert(parts, part)
    end
    if #parts ~= 3 then return nil, "invalid format" end

    local header_b64, payload_b64, sig_b64 = parts[1], parts[2], parts[3]
    local payload_json = base64url_decode(payload_b64)
    if not payload_json then return nil, "invalid payload" end

    local ok, payload = pcall(require("cjson").decode, payload_json)
    if not ok then return nil, "invalid payload json" end

    -- 验证过期
    if payload.exp and payload.exp < os.time() then
        return nil, "token expired"
    end

    -- 验证签名 (HMAC-SHA256)
    local sig = base64url_decode(sig_b64)
    if not sig then return nil, "invalid signature" end

    local hmac = require("resty.hmac").new(CONF.jwt_secret)
    local expected = hmac:hmac_sha256(header_b64 .. "." .. payload_b64)
    hmac:reset()

    if sig ~= expected then
        return nil, "invalid signature"
    end

    return payload
end

-- ============================================================
-- Redis 操作
-- ============================================================

local function get_redis()
    local redis_ok, redis = pcall(require, "resty.redis")
    if not redis_ok then
        _log("redis", "lua-resty-redis 未安装")
        return nil
    end
    local red = redis:new()
    red:set_timeout(CONF.redis_timeout)
    local ok, err = red:connect(CONF.redis_host, CONF.redis_port)
    if not ok then
        _log("redis", "连接失败: " .. (err or "unknown"))
        return nil
    end
    if CONF.redis_db ~= 0 then red:select(CONF.redis_db) end
    return red
end

-- 检查会话缓存
local function check_session(origin, userId)
    local red = get_redis()
    if not red then return nil end

    local key = "llm_session:" .. origin .. ":" .. userId
    local session, err = red:get(key)
    red:close()

    if session and session ~= ngx.null then
        _log("session", "命中缓存: origin=" .. origin .. " userId=" .. userId)
        return session
    end
    return nil
end

-- 创建会话缓存
local function create_session(origin, userId, extra)
    local red = get_redis()
    if not red then return false end

    local key = "llm_session:" .. origin .. ":" .. userId
    local val = require("cjson").encode({
        userId = userId,
        origin = origin,
        extra = extra or {},
        createdAt = ngx.now(),
    })

    red:setex(key, CONF.session_ttl, val)
    red:close()

    _log("session", "创建会话: origin=" .. origin .. " userId=" .. userId .. " ttl=" .. CONF.session_ttl .. "s")
    return true
end

-- 清除会话
local function clear_session(origin, userId)
    local red = get_redis()
    if not red then return false end

    local key = "llm_session:" .. origin .. ":" .. userId
    red:del(key)
    red:close()

    _log("session", "清除会话: origin=" .. origin .. " userId=" .. userId)
    return true
end

-- ============================================================
-- 主逻辑
-- ============================================================

local request_method = var.request_method
local auth_header    = get_header("Authorization")
local cors_origin    = get_header("Origin") or "*"

-- 提取域名
local function extract_domain(origin)
    if not origin or origin == "" or origin == "null" then return "unknown" end
    origin = origin:gsub("^https?://", "")
    origin = origin:gsub("/.*$", "")
    origin = origin:gsub(":%d+$", "")
    return origin
end

local origin_domain = extract_domain(cors_origin)

-- ---------- 1. 检查会话缓存 ----------
local payload = nil
local userId = nil
local session_token = get_header("X-Session-Token")

-- 优先用 session_token（已有会话）
if session_token and #session_token > 10 then
    local parts = {}
    for part in session_token:gmatch("[^%.]+") do
        table.insert(parts, part)
    end
    if #parts == 3 then
        local payload_json = base64url_decode(parts[2])
        if payload_json then
            local ok, p = pcall(require("cjson").decode, payload_json)
            if ok and p.userId then
                userId = p.userId
                local cached = check_session(origin_domain, userId)
                if cached then
                    _log("session", "会话有效，跳过鉴权: origin=" .. origin_domain)
                    payload = p
                else
                    _log("session", "会话已过期，需要重新鉴权")
                    userId = nil
                end
            end
        end
    end
end

-- ---------- 2. JWT 鉴权（无有效会话时）----------
if not payload then
    local jwt_token = ""
    if auth_header and auth_header:find("Bearer ", 1, true) == 1 then
        jwt_token = auth_header:sub(8)
    end

    if not jwt_token or #jwt_token < 10 then
        ngx.header["Content-Type"] = "application/json"
        ngx.status = 401
        ngx.say('{"error":"missing or invalid authorization token"}')
        return ngx.exit(401)
    end

    local err
    payload, err = verify_jwt(jwt_token)
    if err then
        _log("auth", "JWT 验证失败: " .. err)
        ngx.header["Content-Type"] = "application/json"
        ngx.status = 401
        ngx.say('{"error":"invalid token: ' .. (err or "unknown") .. '"}')
        return ngx.exit(401)
    end

    userId = payload.sub or payload.userId or payload.user_id or "unknown"
    _log("auth", "JWT 有效, userId=" .. userId)

    -- 写入会话缓存
    create_session(origin_domain, userId, {
        origin = origin_domain,
    })
end

-- ---------- 3. 速率限制 ----------
if CONF.rate_limit > 0 then
    local red = get_redis()
    if red then
        local key = "llm_rl:" .. userId
        local cnt = red:incr(key)
        if cnt == 1 then red:expire(key, 3600) end
        red:close()
        if cnt > CONF.rate_limit then
            _log("rate", "触发限流: userId=" .. userId .. " cnt=" .. tostring(cnt))
            ngx.header["Content-Type"] = "application/json"
            ngx.status = 429
            ngx.say('{"error":"rate limit exceeded"}')
            return ngx.exit(429)
        end
    end
end

-- ---------- 4. 设置 Nginx 变量 ----------
-- 代理到 edu.roginx.ink/api/llm/（eorder-server 运行在此）
-- nginx 会自动拼接路径：/llm/v1/chat/completions → /api/llm/v1/chat/completions
var.upstream_server = "http://edu.roginx.ink/api/llm"
var.cors_origin = cors_origin

-- ---------- 5. OPTIONS 预检 ----------
if request_method == "OPTIONS" then
    ngx.header["Access-Control-Allow-Origin"]   = cors_origin
    ngx.header["Access-Control-Allow-Methods"]  = "GET,POST,OPTIONS"
    ngx.header["Access-Control-Allow-Headers"]  =
        "Content-Type,Authorization,X-Proxy-Key,X-Proxy-Target,X-Proxy-Model,X-Session-Token"
    ngx.header["Access-Control-Allow-Credentials"] = "true"
    ngx.header["Access-Control-Max-Age"]        = "86400"
    ngx.header["Content-Length"] = "0"
    return ngx.exit(HTTP_NO_CONTENT)
end

-- ---------- 6. 审计日志 ----------
_log("proxy",
    "userId=" .. tostring(userId) ..
    " origin=" .. cors_origin ..
    " domain=" .. origin_domain
)
