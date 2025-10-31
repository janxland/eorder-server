# SSO 单点登录测试指南

## 📋 说明

### `isme.session` 是什么？

`isme.session` 是 **express-session** 配置的**服务器端会话 Cookie** 名称，用于：
- 存储服务器端会话数据（session data）
- 通过 `session secret` 加密存储在 Cookie 中
- 用于维护用户会话状态（不是认证 token）

**注意**：`isme.session` 是会话 Cookie，不是认证 Token。我们实现的 SSO 使用 `sso_access_token` 和 `sso_refresh_token` Cookie。

---

## 🧪 F12 控制台测试代码

### 场景：在 `edu.roginx.ink` 登录后，在 `www.roginx.ink` 验证 SSO

#### 步骤1：在 `edu.roginx.ink` 登录

在浏览器控制台运行：

```javascript
// ========================================
// SSO 测试脚本 - 在 edu.roginx.ink 登录
// ========================================

// 1. 登录（替换为你的用户名和密码）
const loginResponse = await fetch('https://edu.roginx.ink/api/auth-center/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',  // 🔥 关键：允许携带Cookie
  body: JSON.stringify({
    username: 'your_username',  // 替换为你的用户名
    password: 'your_password'   // 替换为你的密码
  })
});

const loginData = await loginResponse.json();
console.log('✅ 登录结果:', loginData);

// 检查Cookie是否设置成功
console.log('📋 当前域名Cookies:', document.cookie);
console.log('📋 响应头Set-Cookie:', loginResponse.headers.get('Set-Cookie'));

// 保存token到localStorage（正常流程）
if (loginData.data && loginData.data.accessToken) {
  localStorage.setItem('auth_token', loginData.data.accessToken);
  localStorage.setItem('refresh_token', loginData.data.refreshToken);
  console.log('✅ Token已保存到localStorage');
}
```

#### 步骤2：在 `www.roginx.ink` 验证 SSO（跨域访问）

**重要**：由于浏览器的同源策略，直接通过 JavaScript 无法跨域读取 HttpOnly Cookie。我们需要通过后端 API 验证。

在 `www.roginx.ink` 的控制台运行：

```javascript
// ========================================
// SSO 测试脚本 - 在 www.roginx.ink 验证凭证
// ========================================

// 方法1：验证token（后端自动从Cookie读取）
async function testSSOFromCookie() {
  console.log('🔍 开始SSO验证（从Cookie读取）...');
  
  // 注意：不需要传递token，后端会自动从Cookie中读取
  const verifyResponse = await fetch('https://www.roginx.ink/api/auth-center/verify-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // 🔥 关键：携带Cookie
    body: JSON.stringify({})  // 不传token，让后端从Cookie读取
  });
  
  const verifyData = await verifyResponse.json();
  console.log('✅ SSO验证结果:', verifyData);
  
  if (verifyData.success && verifyData.valid) {
    console.log('🎉 SSO成功！可以访问用户信息：');
    console.log('  - 用户ID:', verifyData.userId);
    console.log('  - 用户名:', verifyData.username);
    console.log('  - 角色:', verifyData.roles);
    
    // 获取用户详细信息
    const profileResponse = await fetch('https://www.roginx.ink/api/auth-center/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'  // 🔥 关键：携带Cookie
    });
    
    const profileData = await profileResponse.json();
    console.log('👤 用户详细信息:', profileData);
    
    return true;
  } else {
    console.error('❌ SSO验证失败:', verifyData.message || '无法从Cookie读取token');
    return false;
  }
}

// 执行测试
testSSOFromCookie();
```

#### 步骤3：完整的SSO测试流程

```javascript
// ========================================
// 完整SSO测试脚本（一键运行）
// ========================================

(async function testSSOComplete() {
  const currentDomain = window.location.hostname;
  const apiBase = `https://${currentDomain}/api`;
  
  console.log('🌐 当前域名:', currentDomain);
  console.log('🔗 API地址:', apiBase);
  
  // 1. 检查SSO配置
  console.log('\n1️⃣ 检查SSO配置...');
  const configResponse = await fetch(`${apiBase}/auth-center/sso-config`, {
    method: 'GET',
    credentials: 'include'
  });
  const configData = await configResponse.json();
  console.log('📋 SSO配置:', configData);
  
  // 2. 检查localStorage中的token
  console.log('\n2️⃣ 检查localStorage中的token...');
  const localToken = localStorage.getItem('auth_token');
  const localRefreshToken = localStorage.getItem('refresh_token');
  console.log('  - Access Token:', localToken ? '✅ 存在' : '❌ 不存在');
  console.log('  - Refresh Token:', localRefreshToken ? '✅ 存在' : '❌ 不存在');
  
  // 3. 验证token（优先从localStorage，如果没有则从Cookie）
  console.log('\n3️⃣ 验证token...');
  const tokenToVerify = localToken || '';  // 如果没有localStorage，传空字符串让后端从Cookie读取
  const verifyResponse = await fetch(`${apiBase}/auth-center/verify-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ token: tokenToVerify })
  });
  const verifyData = await verifyResponse.json();
  console.log('✅ Token验证结果:', verifyData);
  
  // 4. 获取用户信息（后端自动从Cookie或Authorization头读取token）
  console.log('\n4️⃣ 获取用户信息...');
  try {
    const profileResponse = await fetch(`${apiBase}/auth-center/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(localToken ? { 'Authorization': `Bearer ${localToken}` } : {})  // 如果有localStorage token，添加到请求头
      },
      credentials: 'include'
    });
    const profileData = await profileResponse.json();
    console.log('👤 用户信息:', profileData);
    
    if (profileData.success) {
      console.log('🎉 SSO测试成功！');
    } else {
      console.error('❌ 获取用户信息失败');
    }
  } catch (error) {
    console.error('❌ 获取用户信息出错:', error);
    console.log('💡 提示：这可能是正常的，如果你还没有登录');
  }
  
  return {
    config: configData,
    localToken: !!localToken,
    verify: verifyData,
    success: verifyData.success && verifyData.valid
  };
})();
```

---

## 🔍 跨域测试完整代码（一键复制）

**在 `www.roginx.ink` 的控制台运行以下代码**（前提是已在 `edu.roginx.ink` 登录）：

```javascript
// ============================================
// SSO跨域测试 - 在 www.roginx.ink 验证凭证
// ============================================

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
    console.log('  - Cookie Domain:', config.cookieDomain);
    console.log('  - Current Host:', config.currentHost);
  } catch (error) {
    console.error('❌ 获取配置失败:', error);
  }
  
  // 测试2：验证token（后端自动从Cookie读取）
  console.log('\n🔐 测试2: 验证token（从Cookie）');
  try {
    const verifyRes = await fetch('https://www.roginx.ink/api/auth-center/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({})  // 不传token，让后端从Cookie读取
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
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      const profileData = await profileRes.json();
      console.log('✅ 用户信息:', profileData);
      
      console.log('\n🎉 SSO测试完全成功！可以跨域访问！');
      return { success: true, data: profileData };
    } else {
      console.error('❌ Token验证失败:', verifyData.message);
      console.log('💡 提示：请先在 edu.roginx.ink 登录');
      return { success: false, error: verifyData.message };
    }
  } catch (error) {
    console.error('❌ 验证失败:', error);
    return { success: false, error: error.message };
  }
})();
```

---

## 📝 测试步骤总结

1. **在 `edu.roginx.ink` 登录**：
   - 访问 `https://edu.roginx.ink/login`
   - 正常登录
   - 后端会自动设置 `sso_access_token` 和 `sso_refresh_token` Cookie（domain: `.roginx.ink`）

2. **在 `www.roginx.ink` 验证**：
   - 打开 `https://www.roginx.ink`
   - 按 F12 打开控制台
   - 运行上面的测试代码
   - 应该能看到用户信息，证明 SSO 成功

---

## 🔒 安全说明

1. **HttpOnly Cookie**：Token 存储在 HttpOnly Cookie 中，JavaScript 无法直接读取，防止 XSS 攻击
2. **SameSite=Lax**：防止 CSRF 攻击
3. **Secure Flag**：生产环境启用 HTTPS，自动启用 Secure flag
4. **Domain=.roginx.ink**：所有 `*.roginx.ink` 子域共享 Cookie

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
2. 前端请求设置了 `credentials: 'include'`
3. Cookie 的 domain 设置为 `.roginx.ink`
4. 两个域名都在同一顶级域下（`*.roginx.ink`）

---

## 📚 相关文档

- [SSO 实现指南](./sso.guide.md)
- [Cookie 安全最佳实践](https://owasp.org/www-community/HttpOnly)
