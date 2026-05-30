import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const log = new Logger('Bootstrap');
  const t0 = Date.now();
  const step = (label: string, since?: number) => {
    const now = Date.now();
    const total = now - t0;
    const delta = since ? now - since : total;
    log.log(`⏱  [+${String(total).padStart(5)}ms] (${String(delta).padStart(5)}ms) ${label}`);
    return now;
  };

  let t = step('start bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  t = step('NestFactory.create 完成 (含 TypeORM + Redis 连接 + 所有 Module init)', t);
  
  // 配置极度宽松的验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
      skipMissingProperties: true,
      disableErrorMessages: false,
      validateCustomDecorators: false,
      validationError: { target: false },
      // 关闭所有验证
      forbidUnknownValues: false,
      skipUndefinedProperties: true,
      skipNullProperties: true,
      // 设置为false表示即使验证失败也会通过
      dismissDefaultMessages: true,
    }),
  );
  
  // 解析Cookie - SSO支持
  app.use(cookieParser());
  
  app.use(
    session({
      secret: 'isme',
      name: 'isme.session',
      rolling: true,
      cookie: { maxAge: null },
      resave: false,
      saveUninitialized: true,
    }),
  );
  
  // 允许跨域请求 - SSO增强版
  // 🔥 重要：当 credentials: true 时，origin 不能是 *，必须返回具体的 origin 值
  app.enableCors({
    origin: (origin, callback) => {
      // 如果没有 origin（例如同源请求或某些客户端），允许请求
      if (!origin) {
        return callback(null, true);
      }
      
      // 允许所有 roginx.ink 子域
      const allowedOrigins = [
        /^https?:\/\/(.*\.)?roginx\.ink$/,
        /^https?:\/\/localhost(:\d+)?$/,
      ];
      
      const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
      
      if (isAllowed) {
        // 🔥 关键：返回具体的 origin 值，而不是 true
        callback(null, origin);
      } else {
        // 允许所有来源（生产环境建议配置具体域名白名单）
        callback(null, origin);
      }
    },
    credentials: true,  // 🔥 关键：允许携带Cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie', 'Cache-Control', 'Accept', 'Accept-Language', 'Accept-Encoding'],
    exposedHeaders: ['Set-Cookie', 'Cache-Control', 'Content-Length', 'Content-Type'],
  });
  
  // Swagger OpenAPI 文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('eorder-server API')
    .setDescription('eorder-server 接口文档')
    .setVersion('1.0.0')
    // 使用 Cookie 认证（会话：isme.session）
    .addCookieAuth('isme.session')
    .build();
  t = step('全局中间件 / CORS 配置完成', t);

  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  t = step('Swagger 文档构建完成 (扫描所有 controller)', t);
  SwaggerModule.setup('docs', app, openApiDocument, {
    swaggerOptions: { persistAuthorization: true },
  });
  // 原始 OpenAPI JSON，供移动端/跨端项目直接消费
  app.getHttpAdapter().get('/openapi-json', (req, res) => {
    res.json(openApiDocument);
  });

  await app.listen(process.env.APP_PORT || 8085);
  t = step('HTTP 监听就绪', t);

  log.log(`🚀 启动成功: http://localhost:${process.env.APP_PORT || 8085}  (总耗时 ${Date.now() - t0}ms)`);
}
bootstrap();
