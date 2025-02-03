import { All, Optional } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
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
  @Length(6, 20, {
    message: `用户名长度必须大于$constraint1到$constraint2之间，当前传递的值是$value`,
  })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @Length(6, 20, { message: `密码长度必须大于$constraint1到$constraint2之间` })
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

export class UpdateUserDto {
  @Exclude()
  password: string;

  @Exclude()
  @Allow()
  profile?: Profile;

  @IsString()
  @Optional()
  @Length(2, 20, {
    message: `用户名长度必须大于$constraint1到$constraint2之间，当前传递的值是$value`,
  })
  @IsOptional()
  username?: string;

  @IsBoolean()
  @IsOptional()
  enable?: boolean;

  @IsOptional()
  @IsArray()
  roleIds?: number[];
}

export class updateTeacherDto {
  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  @Optional()
  name: string;

  @Allow()
  phoneNumber: string;

  @Allow()
  department: string;

  @Allow()
  office: string;

  @Allow()
  user: UpdateUserDto

  @Allow()
  researchArea: string;

}

export class UpdateProfileDto extends Profile {


}

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
  @Length(6, 20, { message: `密码长度必须大于$constraint1到$constraint2之间` })
  password: string;
}
