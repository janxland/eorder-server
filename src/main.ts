import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  await app.listen(process.env.APP_PORT || 8085);

  console.log(`🚀 启动成功: http://localhost:${process.env.APP_PORT}`);
}
bootstrap();
