# SSO 单点登录安装配置指南

## 📦 安装依赖

### 1. 安装 cookie-parser（后端）

```bash
cd eorder-server
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

或者使用 pnpm：

```bash
cd eorder-server
pnpm add cookie-parser
pnpm add -D @types/cookie-parser
```

---

## ✅ 已完成的修改

### 后端修改

1. ✅ **auth-center.controller.ts**：
   - 登录时设置 Cookie（`sso_access_token`、`sso_refresh_token`）
   - Cookie domain 设置为 `.roginx.ink`（支持所有子域）
   - Cookie 配置：HttpOnly、Secure（生产环境）、SameSite=Lax
   - 刷新 token 时更新 Cookie
   - 登出时清除 Cookie
   - 验证 token 时支持从 Cookie 读取

2. ✅ **main.ts**：
   - 添加 cookie-parser 中间件
   - CORS 配置添加 `credentials: true`（允许携带 Cookie）

### 前端修改

1. ✅ **request.ts**：
   - axios 实例添加 `withCredentials: true`
   - 请求拦截器支持 Cookie（无 localStorage token 时）

2. ✅ **tokenManager.ts**：
   - 添加 Cookie 读取说明（HttpOnly Cookie 无法直接读取）

---

## 🔧 配置说明

### Cookie Domain 配置

后端会自动根据请求 host 判断 Cookie domain：
- 开发环境（localhost）：`localhost`
- 生产环境（包含 `roginx.ink`）：`.roginx.ink`
- 其他环境：自动提取顶级域名（如 `.example.com`）

### 安全配置

- **HttpOnly**: ✅ 防止 XSS 攻击
- **Secure**: 生产环境自动启用（需要 HTTPS）
- **SameSite**: `lax` 防止 CSRF 攻击
- **MaxAge**: Access Token 6小时，Refresh Token 90天

---

## 🧪 测试步骤

1. **安装依赖**：
   ```bash
   cd eorder-server
   npm install cookie-parser @types/cookie-parser
   ```

2. **重启后端服务**

3. **在 `edu.roginx.ink` 登录**

4. **在 `www.roginx.ink` 测试**：
   - 打开 F12 控制台
   - 运行 `SSO-TEST.md` 中的测试代码

---

## 📝 关于 `isme.session`

`isme.session` 是 **express-session** 配置的**服务器端会话 Cookie**，用于：
- 存储服务器端会话数据（session data）
- 通过 `session secret` 加密存储
- 用于维护用户会话状态（**不是认证 token**）

**注意**：我们实现的 SSO 使用独立的 Cookie：
- `sso_access_token` - 认证 Token
- `sso_refresh_token` - 刷新 Token

这两个 Cookie 和 `isme.session` 是独立的，互不影响。

