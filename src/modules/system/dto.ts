import { IsString, IsNotEmpty, IsBoolean, IsOptional, isString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateSystemDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    code: string;

    @IsString()
    @IsNotEmpty()
    domain: string;

    @IsString()
    ip:string

    @IsString()
    key:string

    @IsString()
    description:string

    @IsBoolean()
    @IsOptional()
    enable?: boolean;
}

export class UpdateSystemDto extends PartialType(CreateSystemDto) {}