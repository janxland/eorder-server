import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
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
  app.enableCors({
    origin: true,  // 允许所有来源（生产环境建议配置具体域名）
    credentials: true,  // 🔥 关键：允许携带Cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });
  
  await app.listen(process.env.APP_PORT || 8085);

  console.log(`🚀 启动成功: http://localhost:${process.env.APP_PORT}`);
}
bootstrap();
