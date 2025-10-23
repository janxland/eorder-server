import { Exclude } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  isNotEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
export class Profile {
  @Allow()
  nickName: string;
  @Allow()
  gender: number;
  @Allow()
  avatar: string;
  @Allow()
  address: string;
  @Allow()
  email: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;

  @IsBoolean()
  @IsOptional()
  enable?: boolean;

  @IsOptional()
  profile?: Profile;

  @IsOptional()
  @IsArray()
  roleIds?: number[];
}

export class createTeacherDto {
  @IsNotEmpty({ message: '用户信息不能为空' })
  createUserDto: CreateUserDto;
  name: string;
}
export class UpdateUserDto {
  @Exclude()
  password: string;

  @Exclude()
  profile?: Profile;

  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsOptional()
  username?: string;

  @IsBoolean()
  @IsOptional()
  enable?: boolean;

  @IsOptional()
  @IsArray()
  roleIds?: number[];
}

export class UpdateProfileDto extends Profile {}

export class GetUserDto {
  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;

  @Allow()
  username?: string;

  @Allow()
  gender?: number;

  @Allow()
  role?: number;

  @Allow()
  enable?: boolean;
}

export class AddUserRolesDto {
  @IsArray()
  roleIds: number[];
}
export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
