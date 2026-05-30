import { Global, Module, ValidationPipe, Logger } from '@nestjs/common';
import { SharedService } from './shared.service';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionFilter } from '@/common/filters/all-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from './redis.service';
import { createClient } from 'redis';
import { User } from '../modules/user/user.entity';
import { Profile } from '../modules/user/profile.entity';
import { Role } from '../modules/role/role.entity';
import { Permission } from '../modules/permission/permission.entity';
import { System } from '../modules/system/system.entity';

const bootLog = new Logger('SharedModule');

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = process.env.DB_HOST || configService.get('DB_HOST');
        const port = +process.env.DB_PORT || configService.get('DB_PORT');
        const sync = process.env.NODE_ENV === 'production' ? false : true;
        bootLog.log(`⏱  TypeORM 正在连接 mysql://${host}:${port}  synchronize=${sync}`);
        const tStart = Date.now();
        return {
          type: 'mysql',
          autoLoadEntities: true,
          host,
          port,
          username: process.env.DB_USER || configService.get('DB_USER'),
          password: process.env.DB_PWD || configService.get('DB_PWD'),
          database: process.env.DB_DATABASE || configService.get('DB_DATABASE'),
          synchronize: sync,
          dropSchema: false,
          timezone: '+08:00',
          logging: ['error', 'warn'],
          extra: {
            charset: 'utf8mb4',
            collation: 'utf8mb4_unicode_ci',
            // 给 mysql2 driver 的连接超时 (毫秒)；公网 MySQL 时快失败胜过挂起
            connectTimeout: 8000,
          },
          // 注意：TypeORM 本身不暴露建连完成事件，以下耗时仅为 config 生成耗时
          // 真正连接耗时看 NestFactory.create() 总耗时
          ...(() => { bootLog.log(`⏱  TypeORM config 准备完成 (${Date.now() - tStart}ms)`); return {}; })(),
        } as any;
      },
    }),
    TypeOrmModule.forFeature([User, Profile, Role, Permission, System]),
  ],
  providers: [
    SharedService,
    RedisService,
    {
      inject: [ConfigService],
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('HOST_IP');
        const redisUsername = configService.get<string>('REDIS_USERNAME', 'default');
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisPort = configService.get<number>('REDIS_PORT', 6739);

        if (!redisUrl || !redisPassword) {
          throw new Error('Missing Redis configuration values');
        }

        bootLog.log(`⏱  Redis 正在连接 redis://${redisUrl}:${redisPort}`);
        const tStart = Date.now();
        const client = createClient({
          socket: {
            host: redisUrl,
            port: redisPort,
            connectTimeout: 8000,
          },
          username: redisUsername,
          password: redisPassword,
        });

        client.on('error', (err) => bootLog.error(`Redis Client Error: ${err?.message}`));
        await client.connect();
        bootLog.log(`✅ Redis 连接成功 (耗时 ${Date.now() - tStart}ms)`);
        return client;
      },
    },
    {
      // 全局错误过滤器
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    {
      // 全局拦截器
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      //全局参数校验管道
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true, // 自动类型转换
      }),
    },
  ],
  exports: [SharedService, RedisService],
})
export class SharedModule {
  private static readonly bootT0 = Date.now();
  onModuleInit() {
    bootLog.log(`⏱  SharedModule onModuleInit (TypeORM + Redis 均已建连) ${Date.now() - SharedModule.bootT0}ms`);
  }
  onApplicationBootstrap() {
    bootLog.log(`⏱  SharedModule onApplicationBootstrap (全部依赖就绪) ${Date.now() - SharedModule.bootT0}ms`);
  }
}
