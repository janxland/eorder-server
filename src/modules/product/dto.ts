import { 
  IsString, 
  IsOptional, 
  IsNotEmpty, 
  IsNumber,
  Allow,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types'; // 导入 PartialType

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  stock: number;
  
  @IsNotEmpty()
  code: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  stock?: number;
}
export class GetProductsDto {
  @Allow()
  name?: string;

  @Allow()
  code?: string;

  @Allow()
  stockStatus?: 'in_stock' | 'out_of_stock';

  @Allow()
  minPrice?: number;

  @Allow()
  maxPrice?: number;

  @Allow()
  pageSize?: number;

  @Allow()
  pageNo?: number;
}