# CDN LLM 网关 - 任意网站 AI 增强方案

## 概述

通过书签注入的方式，让**任意网站**都能使用用户配置的 LLM（大模型）服务。

**核心特性**：首次鉴权后，同域名后续请求自动跳过鉴权（域名级会话缓存）

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   baidu.com              bilibili.com        xqjn.top          │
│   ┌──────────┐           ┌──────────┐       ┌─────────────┐    │
│   │ 首次点击 │           │ 首次点击 │       │  落地页     │    │
│   │ 注入脚本 │           │ 注入脚本 │       │  登录+配置  │    │
│   └────┬─────┘           └────┬─────┘       └─────────────┘    │
│        │                      │                   │               │
│        │ POST /llm/         │ POST /llm/       │               │
│        │ JWT鉴权✓           │ JWT鉴权✓         │               │
│        │ Redis缓存✓         │ Redis缓存✓       │               │
│        ▼                      ▼                   │               │
│   ┌─────────────────────────────────────────┐   │               │
│   │         Redis: llm_session:domain:uid   │   │               │
│   │  baidu.com:user123 → TTL 24h            │   │               │
│   │  bilibili.com:user123 → TTL 24h         │   │               │
│   └─────────────────────────────────────────┘   │               │
│        │                      │                   │               │
│        │ 后续LLM请求          │ 后续LLM请求       │               │
│        │ 命中缓存✓           │ 命中缓存✓         │               │
└────────┼──────────────────────┼───────────────────┘               │
         │                      │                                │
         ▼                      ▼                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx (OpenResty)                          │
│                                                                 │
│   xqjn.top/llm/                                               │
│       │                                                        │
│       ├── access_by_lua_file xqjn-llm-auth.lua                │
│       │   ├─ 检查 Redis 会话缓存                               │
│       │   ├─ 无缓存 → JWT 鉴权 → 创建缓存                     │
│       │   └─ 有缓存 → 直接放行                                 │
│       │                                                        │
│       └── proxy_pass edu.roginx.ink/api/llm/                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    edu.roginx.ink (eorder-server)                │
│                                                                 │
│   /api/llm/v1/chat/completions                                 │
│       │                                                        │
│       └── LLMProxyController                                   │
│               │                                                │
│               ├── 读取 X-Proxy-Key (用户API Key)              │
│               ├── 读取 X-Proxy-Target (用户指定BaseURL)        │
│               │                                                │
│               └── 代理到用户指定的 LLM 服务商                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    任意 LLM 服务商                               │
│            OpenAI / 硅基流动 / Ollama / 其他兼容 API              │
└─────────────────────────────────────────────────────────────────┘
```

## 核心设计

### 1. 域名级会话缓存

```
Redis Key: llm_session:{域名}:{用户ID}
Value: {"userId":"xxx","origin":"baidu.com","createdAt":1234567890}
TTL: 24小时（可配置）
```

**流程**：
1. 用户在 baidu.com 首次调用 LLM → 验证 JWT → 创建缓存
2. 用户在 baidu.com 后续调用 → 检查缓存存在 → 直接放行
3. 用户在 bilibili.com 调用 → 需要重新鉴权（独立缓存）

### 2. 书签注入

```
用户访问落地页
    ↓
登录（获得 JWT）
    ↓
配置 API Key + Base URL + Model（存 localStorage）
    ↓
拖拽书签到收藏夹
    ↓
在任意网站点击书签 → 脚本从 localStorage 读取配置 → 调用 /llm/
```

### 3. 完整数据流

```
1. 浏览器 POST /llm/v1/chat/completions
   Headers:
     Authorization: Bearer <JWT>
     X-Proxy-Key: sk-xxx           ← 用户自己的 API Key
     X-Proxy-Target: https://...   ← 用户指定的 Base URL

2. Nginx Lua 鉴权 (xqjn-llm-auth.lua)
   ├─ 检查 Redis: llm_session:baidu.com:user123
   │    ├─ 有缓存 → 直接放行，跳过鉴权
   │    └─ 无缓存 → JWT 验证 → 创建缓存
   │
   └─ 代理到 edu.roginx.ink/api/llm/v1/chat/completions

3. eorder-server LLMProxyController
   ├─ 读取 X-Proxy-Key → 作为 Authorization Bearer
   ├─ 读取 X-Proxy-Target → 作为上游 Base URL
   │
   └─ 代理到用户指定的 LLM 服务商

4. LLM 服务商响应流式数据
   └─ 原样返回给浏览器
```

## API 接口

### LLM 代理网关

```
POST /llm/v1/chat/completions
Headers:
  Authorization: Bearer <JWT>           # 首次必填
  X-Proxy-Key: <用户API Key>           # 必填
  X-Proxy-Target: <Base URL>            # 可选
  X-Session-Token: <session>            # 可选，已有会话时用
```

### CDN 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cdn/config` | 获取用户所有 CDN 配置 |
| POST | `/api/cdn/config` | 创建 CDN 配置 |
| PATCH | `/api/cdn/config/:id` | 更新 CDN 配置 |
| DELETE | `/api/cdn/config/:id` | 删除 CDN 配置 |

## 组件

| 文件 | 职责 |
|------|------|
| `bookmark-landing.ts` | 落地页：登录 + JWT + LLM 配置 + 书签生成 |
| `cdn-config.entity.ts` | CDN 配置实体 |
| `cdn-config.service.ts` | CDN 配置 CRUD |
| `cdn-config.controller.ts` | CDN 配置 API |
| `llm-proxy.controller.ts` | LLM 代理请求处理（接收 Nginx 代理） |
| `scripts/nginx-lua/xqjn-llm-auth.lua` | JWT 鉴权 + 会话缓存 |
| `scripts/nginx-lua/llm-proxy.conf` | Nginx 配置 |
| `scripts/nginx-lua/deploy-llm-proxy.js` | 部署脚本 |

## 安全性

| 风险点 | 防护措施 |
|--------|----------|
| JWT 过期 | 检查 exp 字段，过期拒绝 |
| 会话滥用 | TTL 限制 24 小时 |
| 跨域泄露 | API Key 存用户本地 |
| 恶意代理 | Target URL 必须 HTTPS |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROXY_JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `LLM_SESSION_TTL` | 会话缓存 TTL（秒）| `86400`（24小时）|
| `NGINX_SSH_HOST` | Nginx 服务器地址 | `xqjn.top` |

## 使用流程

### 1. 部署

```bash
cd services/eorder-server/scripts/nginx-lua
LLM_PROXY_JWT_SECRET=your-secret node deploy-llm-proxy.js
```

### 2. 用户使用

```
1. 访问 https://xqjn.top/cdn-script/landing
2. 登录（获得 JWT）
3. 配置 API Key、Base URL、Model
4. 拖拽"LLM 网关"书签到收藏夹
5. 在任意网站点击书签
6. 享受 AI 增强！
```

### 3. 调用示例

```javascript
// 书签脚本注入后，自动调用
fetch('https://xqjn.top/llm/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Proxy-Key': apiKey,
    'X-Proxy-Target': baseUrl,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'Qwen/Qwen2.5-7B-Instruct',
    messages: [{ role: 'user', content: 'Hello' }]
  })
})
```

## 与传统方案对比

| 特性 | 传统 CORS 代理 | 本方案 |
|------|----------------|--------|
| 跨域 | 需要配置 | 天然支持 |
| 鉴权 | 每次请求 | 首次鉴权，后续缓存 |
| 域名隔离 | 无 | 域名级独立会话 |
| 书签化 | 不支持 | 原生支持 |
| 多供应商 | 固定配置 | 用户自由切换 |
