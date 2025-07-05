# 部署指南

本文档提供了构建和部署 NestJS 应用程序的详细步骤。

## 构建选项

我们提供了多种构建选项，以满足不同的部署需求：

### 1. 标准构建

```bash
npm run build
# 或
pnpm build
```

这将生成标准的 NestJS 构建输出到 `dist` 目录，以及使用 `@vercel/ncc` 打包的单文件输出到 `ncc-dist` 目录。

### 2. 生产环境构建

```bash
npm run build:prod
# 或
pnpm build:prod
```

与标准构建类似，但会对输出进行压缩，减小文件大小。

### 3. 独立部署构建

```bash
npm run build:standalone
# 或
pnpm build:standalone
```

这将生成一个完全独立的构建，输出到 `deploy` 目录，包含一个压缩的单文件应用程序，不需要 `node_modules`。

## 部署步骤

### 方法 1: 使用独立构建（推荐）

这种方法不需要在生产服务器上安装 `node_modules`，只需要 Node.js 环境。

1. 准备部署文件：

```bash
npm run deploy:prepare
# 或
pnpm deploy:prepare
```

这个命令会：
- 构建独立应用程序
- 复制 `package.json` 到部署目录（仅用于信息目的）
- 复制 `.env` 文件（如果存在）
- 复制 `migrations` 目录（如果存在）

2. 将 `deploy` 目录复制到生产服务器

3. 在生产服务器上运行：

```bash
node index.js
```

### 方法 2: 使用 PM2 进行进程管理

1. 按照方法 1 准备部署文件

2. 在生产服务器上安装 PM2：

```bash
npm install -g pm2
```

3. 创建 PM2 配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'eorder-server',
    script: './index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

4. 使用 PM2 启动应用：

```bash
pm2 start ecosystem.config.js
```

## 部署文件结构

使用 `deploy:prepare` 命令后，`deploy` 目录将包含以下文件：

```
deploy/
  ├── index.js        # 打包的应用程序（包含所有依赖）
  ├── package.json    # 项目信息
  ├── .env            # 环境变量（如果存在）
  └── migrations/     # 数据库迁移文件（如果存在）
```

## 环境变量

确保在生产服务器上设置了必要的环境变量，或者在 `.env` 文件中提供它们。

## 数据库迁移

如果需要运行数据库迁移，您可以使用 TypeORM CLI：

```bash
npx typeorm migration:run -d dist/config/typeorm.config.js
```

## 故障排除

### 应用程序启动问题

如果应用程序无法启动，请检查：

1. Node.js 版本是否兼容（推荐 v16+）
2. 环境变量是否正确设置
3. 数据库连接是否可用

### 权限问题

确保运行应用程序的用户有足够的权限访问所需的文件和目录。

### 日志查看

使用 PM2 时，可以通过以下命令查看日志：

```bash
pm2 logs eorder-server
``` 