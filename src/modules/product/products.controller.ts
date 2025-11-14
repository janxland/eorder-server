import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { GetProductsDto,CreateProductDto,UpdateProductDto } from './dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';

@Controller('products')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermission(PermissionCode.CREATE_PRODUCT)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @RequirePermission(PermissionCode.SHOW_PRODUCT_LIST)
  getAll(@Query() queryDto: GetProductsDto){
      return this.productsService.findAll(queryDto);
  }

  @Get(':id')
  @RequirePermission(PermissionCode.SHOW_PRODUCT_DETAIL)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermission(PermissionCode.UPDATE_PRODUCT)
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_PRODUCT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}