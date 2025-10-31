# Nginx 配置指南 - SSO Cookie 支持

## 问题分析

根据您的请求头，发现以下问题：

1. **响应头显示 `access-control-allow-origin: *`** - 这是nginx默认的CORS配置，会覆盖NestJS的CORS设置
2. **Cookie未出现在响应头** - 可能是nginx过滤了Cookie响应头

## 🔧 Nginx 配置修复

### 1. 修改 Nginx 配置（关键）

在您的nginx配置文件中（通常是 `/etc/nginx/sites-available/edu.roginx.ink` 或类似），**移除或注释掉**以下配置：

```nginx
# ❌ 错误配置：会覆盖后端CORS设置
add_header Access-Control-Allow-Origin *;
```

### 2. 正确的 Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name edu.roginx.ink;

    # SSL配置...
    
    location /api/ {
        proxy_pass http://127.0.0.1:8085/;  # 后端服务地址
        
        # 🔥 关键：不要在这里设置CORS头，让后端处理
        # ❌ 不要添加：add_header Access-Control-Allow-Origin *;
        
        # 🔥 关键：必须透传请求头到后端
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # 🔥 重要：告诉后端是HTTPS
        proxy_set_header Origin $http_origin;
        
        # 🔥 关键：必须透传响应头，不要过滤Set-Cookie
        proxy_pass_header Set-Cookie;
        proxy_cookie_path / /;
        proxy_cookie_domain off;  # 不修改Cookie domain，让后端设置
        
        # 🔥 关键：不要覆盖CORS响应头，让后端处理
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Credentials;
        
        # 必须暴露这些头，让前端能读取
        proxy_set_header Access-Control-Expose-Headers "Set-Cookie";
    }
}
```

### 3. 或者：完全让后端处理CORS（推荐）

```nginx
server {
    listen 443 ssl http2;
    server_name edu.roginx.ink;
    
    location /api/ {
        proxy_pass http://127.0.0.1:8085/;
        
        # 基本代理配置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # 🔥 HTTPS标志
        proxy_set_header Origin $http_origin;
        
        # 🔥 关键：透传所有响应头，包括Set-Cookie和CORS头
        proxy_pass_header Set-Cookie;
        proxy_cookie_path / /;
        
        # ❌ 不要在这里添加任何CORS相关配置
        # 让NestJS后端完全控制CORS响应头
    }
}
```

## 🔍 验证步骤

1. **重启nginx**：
   ```bash
   sudo nginx -t  # 测试配置
   sudo nginx -s reload  # 重新加载配置
   ```

2. **清除浏览器Cookie**，重新登录

3. **检查响应头**：
   - `Access-Control-Allow-Origin` 应该是具体的域名（如 `https://edu.roginx.ink`），而不是 `*`
   - `Access-Control-Allow-Credentials: true` 应该存在
   - 应该有 `Set-Cookie: sso_access_token=...` 和 `Set-Cookie: sso_refresh_token=...`

## 🐛 常见问题

### Q: 为什么响应头还是 `*`？
**A**: nginx可能在全局配置或server块中设置了 `add_header Access-Control-Allow-Origin *;`，需要找到并移除。

### Q: 如何找到nginx配置文件？
**A**: 
```bash
# 查看nginx主配置文件
cat /etc/nginx/nginx.conf

# 查看站点配置
ls /etc/nginx/sites-available/
ls /etc/nginx/sites-enabled/

# 或者查看nginx进程使用的配置文件
sudo nginx -T | grep "server_name edu.roginx.ink" -A 20
```

### Q: Cookie设置了但没有跨域共享？
**A**: 
1. 检查Cookie的domain是否正确（应该是 `.roginx.ink`）
2. 检查两个域名是否在同一顶级域下（`edu.roginx.ink` 和 `www.roginx.ink`）
3. 检查浏览器控制台是否有CORS错误

## 📝 检查清单

- [ ] nginx配置中没有 `add_header Access-Control-Allow-Origin *;`
- [ ] nginx配置中有 `proxy_set_header X-Forwarded-Proto $scheme;`
- [ ] nginx配置中有 `proxy_pass_header Set-Cookie;`
- [ ] 后端服务已重启
- [ ] nginx配置已重新加载
- [ ] 浏览器Cookie已清除
- [ ] 重新登录后检查响应头

