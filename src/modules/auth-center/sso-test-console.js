/**
 * SSO 单点登录测试代码
 * 在浏览器 F12 控制台中运行
 * 
 * 使用说明：
 * 1. 在 edu.roginx.ink 登录
 * 2. 在 www.roginx.ink 打开 F12 控制台
 * 3. 复制以下代码运行
 */

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
    console.log('  - Environment:', config.environment);
    console.log('  - Cookies:', config.cookies);
  } catch (error) {
    console.error('❌ 获取配置失败:', error);
    return { success: false, error: error.message };
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
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        console.log('✅ 用户信息:', profileData);
        
        console.log('\n🎉 SSO测试完全成功！可以跨域访问！');
        console.log('\n📊 测试总结:');
        console.log('  ✅ Cookie跨域共享成功');
        console.log('  ✅ Token验证成功');
        console.log('  ✅ 用户信息获取成功');
        console.log('  ✅ SSO单点登录工作正常');
        
        return { success: true, data: profileData };
      } else {
        console.error('❌ 获取用户信息失败:', profileRes.status, profileRes.statusText);
        const errorData = await profileRes.json().catch(() => ({}));
        console.error('错误详情:', errorData);
        return { success: false, error: '获取用户信息失败' };
      }
    } else {
      console.error('❌ Token验证失败:', verifyData.message || 'Token无效');
      console.log('💡 提示：');
      console.log('  1. 请确保已在 edu.roginx.ink 登录');
      console.log('  2. 检查浏览器Cookie中是否有 sso_access_token（domain: .roginx.ink）');
      console.log('  3. 检查后端CORS配置是否允许携带Cookie');
      return { success: false, error: verifyData.message || 'Token验证失败' };
    }
  } catch (error) {
    console.error('❌ 验证失败:', error);
    console.log('💡 可能的原因:');
    console.log('  - 网络请求失败');
    console.log('  - CORS配置问题');
    console.log('  - 后端服务未启动');
    return { success: false, error: error.message };
  }
})();

// ============================================
// 额外测试：检查localStorage中的token
// ============================================

console.log('\n📦 检查localStorage中的token:');
const localToken = localStorage.getItem('auth_token');
const localRefreshToken = localStorage.getItem('refresh_token');
console.log('  - Access Token:', localToken ? '✅ 存在' : '❌ 不存在');
console.log('  - Refresh Token:', localRefreshToken ? '✅ 存在' : '❌ 不存在');

if (localToken) {
  console.log('\n💡 提示：localStorage中有token，这很正常。');
  console.log('SSO同时支持两种方式：');
  console.log('  1. localStorage中的token（通过Authorization头传递）');
  console.log('  2. Cookie中的token（自动携带，HttpOnly）');
  console.log('后端会优先使用Authorization头，如果没有则从Cookie读取。');
}

