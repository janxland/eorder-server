# SSO 单点登录实现总结

## ✅ 已完成

### 1. `isme.session` 说明

**`isme.session`** 是 **express-session** 配置的**服务器端会话 Cookie**，用于：
- 存储服务器端会话数据（session data）
- 通过 `session secret` 加密存储
- 用于维护用户会话状态（**不是认证 token**）

**注意**：我们实现的 SSO 使用独立的 Cookie：
- `sso_access_token` - 认证 Access Token
- `sso_refresh_token` - 刷新 Refresh Token

这两个 Cookie 和 `isme.session` 是独立的，互不影响。

---

### 2. 后端实现

#### 修改的文件：

1. **auth-center.controller.ts**：
   - ✅ 登录时设置 Cookie（domain: `.roginx.ink`）
   - ✅ Cookie 配置：HttpOnly、Secure（生产环境）、SameSite=Lax
   - ✅ 刷新 token 时更新 Cookie
   - ✅ 登出时清除 Cookie
   - ✅ 验证 token 时支持从 Cookie 读取
   - ✅ 新增 `/auth-center/sso-config` 接口（用于调试）

2. **main.ts**：
   - ✅ 添加 cookie-parser 中间件
   - ✅ CORS 配置添加 `credentials: true`

#### 关键代码：

```typescript
// 登录时设置Cookie
res.cookie('sso_access_token', result.accessToken, {
  domain: '.roginx.ink',  // 🔥 关键：支持所有 *.roginx.ink 子域
  httpOnly: true,         // 防止XSS攻击
  secure: process.env.NODE_ENV === 'production',  // 生产环境启用HTTPS
  sameSite: 'lax',       // CSRF防护
  maxAge: result.expiresIn * 1000,
  path: '/',
});
```

---

### 3. 前端实现

#### 修改的文件：

1. **request.ts**：
   - ✅ axios 实例添加 `withCredentials: true`
   - ✅ 请求拦截器支持 Cookie（无 localStorage token 时）

2. **tokenManager.ts**：
   - ✅ 添加 Cookie 读取说明（HttpOnly Cookie 无法直接读取）

---

## 🚀 使用方法

### 1. 安装依赖

```bash
cd eorder-server
npm install cookie-parser @types/cookie-parser
```

### 2. 重启后端服务

### 3. 测试流程

1. **在 `edu.roginx.ink` 登录**：
   - 正常登录流程
   - 后端会自动设置 Cookie（domain: `.roginx.ink`）

2. **在 `www.roginx.ink` 验证**：
   - 打开 F12 控制台
   - 运行 `sso-test-console.js` 中的代码
   - 应该能看到用户信息，证明 SSO 成功

---

## 📋 测试代码

### 一键复制测试代码（在 `www.roginx.ink` 控制台运行）：

```javascript
(async function testCrossDomainSSO() {
  console.log('🧪 开始SSO跨域测试...');
  console.log('📍 当前域名:', window.location.hostname);
  
  // 测试1：获取SSO配置
  console.log('\n📋 测试1: 获取SSO配置');
  try {
    const configRes = await fetch('https://www.roginx.ink/api/auth-center/sso-config', {
      method: 'GET',
      credentials: 'include'
    });
    const config = await configRes.json();
    console.log('✅ SSO配置:', config);
  } catch (error) {
    console.error('❌ 获取配置失败:', error);
    return;
  }
  
  // 测试2：验证token（后端自动从Cookie读取）
  console.log('\n🔐 测试2: 验证token（从Cookie）');
  try {
    const verifyRes = await fetch('https://www.roginx.ink/api/auth-center/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    const verifyData = await verifyRes.json();
    
    if (verifyData.success && verifyData.valid) {
      console.log('✅ Token验证成功！');
      console.log('  - 用户ID:', verifyData.userId);
      console.log('  - 用户名:', verifyData.username);
      console.log('  - 角色:', verifyData.roles);
      
      // 测试3：获取用户详细信息
      console.log('\n👤 测试3: 获取用户详细信息');
      const profileRes = await fetch('https://www.roginx.ink/api/auth-center/profile', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const profileData = await profileRes.json();
      console.log('✅ 用户信息:', profileData);
      console.log('\n🎉 SSO测试完全成功！可以跨域访问！');
    } else {
      console.error('❌ Token验证失败:', verifyData.message);
      console.log('💡 提示：请先在 edu.roginx.ink 登录');
    }
  } catch (error) {
    console.error('❌ 验证失败:', error);
  }
})();
```

---

## 🔒 安全特性

1. **HttpOnly Cookie**：防止 XSS 攻击，JavaScript 无法直接读取
2. **Secure Flag**：生产环境启用 HTTPS，自动启用 Secure flag
3. **SameSite=Lax**：防止 CSRF 攻击
4. **Domain=.roginx.ink**：所有 `*.roginx.ink` 子域共享 Cookie

---

## 📝 工作原理

```
1. 用户在 edu.roginx.ink 登录
   ↓
2. 后端验证用户名密码
   ↓
3. 后端生成 JWT Token
   ↓
4. 后端设置 Cookie（domain: .roginx.ink）
   - sso_access_token (HttpOnly)
   - sso_refresh_token (HttpOnly)
   ↓
5. 前端保存 Token 到 localStorage（可选）
   ↓
6. 用户在 www.roginx.ink 访问
   ↓
7. 前端请求自动携带 Cookie（withCredentials: true）
   ↓
8. 后端自动从 Cookie 读取 Token
   ↓
9. 验证通过，返回用户信息
   ✅ SSO 成功！
```

---

## 🐛 常见问题

### Q: 为什么在控制台看不到 `sso_access_token` Cookie？
**A**: 因为 Cookie 设置了 `HttpOnly` 标志，JavaScript 无法通过 `document.cookie` 读取。这是安全特性。

### Q: 如何验证 Cookie 是否设置成功？
**A**: 
1. 打开浏览器开发者工具
2. 进入 Application/Storage 标签
3. 查看 Cookies → `https://edu.roginx.ink`
4. 应该能看到 `sso_access_token` 和 `sso_refresh_token`（domain: `.roginx.ink`）

### Q: 跨域请求失败怎么办？
**A**: 确保：
1. 后端 CORS 配置了 `credentials: true`
2. 前端请求设置了 `withCredentials: true`
3. Cookie 的 domain 设置为 `.roginx.ink`
4. 两个域名都在同一顶级域下（`*.roginx.ink`）

---

## 📚 相关文档

- [SSO 测试指南](./SSO-TEST.md)
- [SSO 安装配置](./SSO-SETUP.md)
- [SSO 实现指南](./sso.guide.md)

