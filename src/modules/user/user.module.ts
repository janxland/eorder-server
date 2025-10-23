import { forwardRef, Global, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Role } from '@/modules/role/role.entity';
import { Profile } from './profile.entity';
import { Permission } from '@/modules/permission/permission.entity';
import { AuthCenterModule } from '../auth-center/auth-center.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Role, Permission]),
    forwardRef(() => AuthCenterModule)
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
