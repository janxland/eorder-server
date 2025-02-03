import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
import { GetProductsDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(query: GetProductsDto) {
    const pageSize = query.pageSize || 10;
    const pageNo = query.pageNo || 1;
  
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .where('1 = 1');
  
    // 商品名称模糊查询
    if (query.name) {
      queryBuilder.andWhere('product.name LIKE :name', { 
        name: `%${query.name}%` 
      });
    }
  
    // 商品代码精确查询
    if (query.code) {
      queryBuilder.andWhere('product.code = :code', { 
        code: query.code 
      });
    }
  
    // 库存状态筛选
    if (query.stockStatus) {
      if (query.stockStatus === 'in_stock') {
        queryBuilder.andWhere('product.stock > 0');
      } else if (query.stockStatus === 'out_of_stock') {
        queryBuilder.andWhere('product.stock <= 0');
      }
    }
  
    // 价格范围筛选
    if (query.minPrice) {
      queryBuilder.andWhere('product.price >= :minPrice', {
        minPrice: query.minPrice
      });
    }
    if (query.maxPrice) {
      queryBuilder.andWhere('product.price <= :maxPrice', {
        maxPrice: query.maxPrice
      });
    }
  
    const [products, total] = await queryBuilder
      .orderBy('product.createdAt', 'DESC') // 使用正确的日期字段
      .skip((pageNo - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
  
    return { 
      pageData: products.map(p => ({
        ...p,
        // 转换decimal类型为数字
        price: Number(p.price)
      })), 
      total 
    };
  }
  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepository.preload({
      id: id,
      ...updateProductDto,
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return this.productRepository.save(product);
  }

  async remove(id: number): Promise<void> {
    const result = await this.productRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product #${id} not found`);
    }
  }
}