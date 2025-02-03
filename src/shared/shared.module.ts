import { Global, Module, ValidationPipe } from '@nestjs/common';
import { SharedService } from './shared.service';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionFilter } from '@/common/filters/all-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from './redis.service';
import { createClient } from 'redis';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        console.log('DB_HOST', process.env.DB_HOST || configService.get('DB_HOST'))
        
        return {
          type: 'mysql',
          autoLoadEntities: true,
          host: process.env.DB_HOST || configService.get('DB_HOST'),
          port: +process.env.DB_PORT || configService.get('DB_PORT'),
          username: process.env.DB_USER || configService.get('DB_USER'),
          password: process.env.DB_PWD || configService.get('DB_PWD'),
          database: process.env.DB_DATABASE || configService.get('DB_DATABASE'),
          synchronize: process.env.NODE_ENV === 'production' ? false : configService.get('DB_SYNC'),
          timezone: '+08:00',
        };
      },
    }),
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
        
        const client = createClient({
          socket: {
            host: redisUrl,
            port: redisPort,
          },
          username: redisUsername,
          password: redisPassword,
        });
    
        client.on('error', (err) => console.error('Redis Client Error', err));
        await client.connect();
        console.log('✅ Redis 连接成功');
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
export class SharedModule {}
