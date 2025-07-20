# eOrder Server

## 项目介绍

eOrder Server 是一个基于 NestJS 框架开发的后端服务系统，提供完整的用户认证、权限管理、订单处理等功能。本项目使用现代化的技术栈和架构设计，为前端应用提供稳定、安全的 API 接口服务。

## 技术栈

- **框架**: NestJS 10.x
- **数据库**: MySQL + TypeORM
- **缓存**: Redis
- **认证**: JWT (JSON Web Token)
- **消息队列**: RabbitMQ
- **API文档**: Swagger/OpenAPI
- **云存储**: 支持腾讯云COS、阿里云OSS、七牛云等多种云存储服务

## 核心功能

- **用户认证与授权**
  - JWT 认证
  - 刷新令牌机制
  - 多端会话管理
  - 基于角色的访问控制(RBAC)

- **权限管理系统**
  - 菜单权限管理
  - 角色权限分配
  - 资源访问控制

- **订单系统**
  - 订单创建与管理
  - 支付集成
  - 订单状态跟踪

- **产品管理**
  - 产品信息管理
  - 产品分类

- **云存储管理**
  - 多云存储服务集成(COS、OSS、七牛云)
  - 支持每种类型多配置并存
  - 统一的文件上传与管理接口
  - CDN加速与鉴权

- **系统配置**
  - 动态配置管理
  - 键值对存储

## 环境要求

- Node.js >= 16.x
- MySQL >= 8.0
- Redis >= 6.0

## 安装与使用

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/eorder-server.git
cd eorder-server
```

### 2. 安装依赖

```bash
npm install
# 或
yarn install
```
eorder-server服务：
NestJS后端服务
支持多种部署方式：
标准部署：npm run start:prod（使用dist/main.js）
独立部署：npm run build:standalone生成独立部署包，然后npm run start:standalone
部署准备：npm run deploy:prepare（生成deploy目录，包含所需文件）
### 3. 配置环境变量

创建 `.env` 或 `.env.local` 文件，参考以下配置：

```env
# 应用配置
NODE_ENV=development
APP_PORT=8085

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PWD=yourpassword
DB_DATABASE=eorder
DB_SYNC=true

# Redis配置
HOST_IP=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=yourpassword

# JWT配置
JWT_SECRET=your-jwt-secret-key
```

### 4. 初始化数据库

```bash
# 导入基础数据
mysql -u username -p database_name < init.sql
# 导入权限数据
mysql -u username -p database_name < permission.sql
```

### 5. 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## 云存储模块使用指南

### 配置管理

系统支持同时配置多个云存储服务提供商(COS、OSS、七牛云)，并且每种类型可以有多个配置，适用于多租户、多应用场景或CDN鉴权中心。

#### 1. 创建存储配置

管理员可以通过以下API创建云存储配置：

```bash
POST /cloud-storage/config
```

请求体示例（腾讯云COS）：

```json
{
  "name": "测试腾讯云COS",
  "provider": "COS",
  "accessKeyId": "your-secret-id",
  "accessKeySecret": "your-secret-key",
  "bucket": "your-bucket-name",
  "region": "ap-guangzhou",
  "domain": "https://your-bucket-name.cos.ap-guangzhou.myqcloud.com",
  "isDefault": true,
  "isEnabled": true,
  "remark": "测试环境使用"
}
```

腾讯云COS的另一个配置示例：

```json
{
  "name": "生产腾讯云COS",
  "provider": "COS",
  "accessKeyId": "prod-secret-id",
  "accessKeySecret": "prod-secret-key",
  "bucket": "prod-bucket-name",
  "region": "ap-beijing",
  "domain": "https://cdn.example.com",
  "isDefault": false,
  "isEnabled": true,
  "remark": "生产环境使用，配置了CDN"
}
```

#### 2. 查询可用配置

查询指定类型的所有可用配置：

```bash
GET /cloud-storage/config/by-type/COS
```

响应示例：

```json
[
  {
    "id": 1,
    "name": "测试腾讯云COS",
    "provider": "COS",
    "accessKeyId": "your-secret-id",
    "accessKeySecret": "your-secret-key",
    "bucket": "your-bucket-name",
    "region": "ap-guangzhou",
    "domain": "https://your-bucket-name.cos.ap-guangzhou.myqcloud.com",
    "isDefault": true,
    "isEnabled": true,
    "remark": "测试环境使用"
  },
  {
    "id": 2,
    "name": "生产腾讯云COS",
    "provider": "COS",
    "accessKeyId": "prod-secret-id",
    "accessKeySecret": "prod-secret-key",
    "bucket": "prod-bucket-name",
    "region": "ap-beijing",
    "domain": "https://cdn.example.com",
    "isDefault": false,
    "isEnabled": true,
    "remark": "生产环境使用，配置了CDN"
  }
]
```

### 文件操作

所有文件操作API都支持通过`configId`参数指定使用哪个存储配置。如果不指定，则使用对应类型的默认配置。

#### 1. 获取上传凭证

```bash
GET /cloud-storage/token?provider=COS&configId=2
```

#### 2. 获取上传URL

```bash
GET /cloud-storage/upload-url?provider=COS&key=images/example.jpg&configId=2
```

#### 3. 获取文件访问URL

```bash
GET /cloud-storage/file-url?provider=COS&key=images/example.jpg&configId=2
```

#### 4. 上传文件

```bash
POST /cloud-storage/upload
Content-Type: multipart/form-data

file: [二进制文件]
provider: COS
configId: 2
```

#### 5. 删除文件

```bash
DELETE /cloud-storage
Content-Type: application/json

{
  "provider": "COS",
  "key": "images/example.jpg",
  "configId": 2
}
```

### 代码示例

前端调用示例（使用axios）：

```javascript
// 获取腾讯云COS的所有可用配置
async function getCosConfigs() {
  const response = await axios.get('/cloud-storage/config/by-type/COS');
  return response.data;
}

// 上传文件到腾讯云COS（指定配置ID）
async function uploadFileToCos(file, configId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('provider', 'COS');
  if (configId) {
    formData.append('configId', configId);
  }
  
  const response = await axios.post('/cloud-storage/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data.url;
}

// 获取腾讯云COS文件的临时访问URL
async function getFileUrl(key, configId) {
  const params = {
    provider: 'COS',
    key,
    configId,
    expires: 3600 // 1小时有效期
  };
  
  const response = await axios.get('/cloud-storage/file-url', { params });
  return response.data.url;
}
```

后端服务调用示例：

```typescript
// 注入CloudStorageService
constructor(private readonly cloudStorageService: CloudStorageService) {}

// 上传图片到腾讯云COS
async uploadImageToCos(file: Buffer, configId?: number) {
  const key = `images/${Date.now()}-${uuidv4()}.jpg`;
  return this.cloudStorageService.uploadFile(
    StorageProviderType.COS,
    file,
    key,
    { mimeType: 'image/jpeg' },
    configId
  );
}

// 获取腾讯云COS文件的临时访问URL
async getCosTempUrl(key: string, configId?: number) {
  // 默认1小时有效期
  return this.cloudStorageService.getFileUrl(
    StorageProviderType.COS,
    key,
    3600,
    configId
  );
}
```

## 未来计划

- **性能优化**
  - 缓存策略优化
  - 数据库查询优化
  - 负载均衡支持

- **监控与日志**
  - 系统监控集成
  - 操作日志记录
  - 错误追踪

## 贡献指南

欢迎提交 Issue 或 Pull Request 来帮助改进项目。

## 版权说明

本项目使用 MIT 协议，详细信息请查看 [LICENSE](LICENSE) 文件。
