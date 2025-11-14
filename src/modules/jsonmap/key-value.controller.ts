import { Controller, Get, Post, Delete, Body, Query, Param, Patch, UseGuards } from '@nestjs/common';
import { KeyValueService } from './key-value.service';
import { CreateKeyValueDto, GetKeyValueDto, UpdateKeyValueDto } from './dto';
import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PermissionCode } from '@/common/enums/permission-code.enum';
import { Public } from '@/common/decorators/public.decorator';

@Controller('/key-value')
@UseGuards(AuthCenterGuard, PermissionCodeGuard)
export class KeyValueController {
  constructor(private readonly keyValueService: KeyValueService) {}
  @Get()
  @RequirePermission(PermissionCode.SHOW_KEY_VALUE_LIST)
  getAll(@Query()  queryDto: GetKeyValueDto){
    return this.keyValueService.findAll(queryDto);
  }
  //只取一个
  @Get("/query")
  @Public()
  async Query(@Query()  queryDto: GetKeyValueDto){
    return (await this.keyValueService.findAll(queryDto)).pageData[0];
  }

  @Post()
  @RequirePermission(PermissionCode.CREATE_KEY_VALUE)
  async createOrUpdate(@Body() dto: CreateKeyValueDto | UpdateKeyValueDto) {
    return this.keyValueService.createOrUpdate(dto);
  }
  @Patch(':id')
  @RequirePermission(PermissionCode.UPDATE_KEY_VALUE)
  async update(@Body() dto: CreateKeyValueDto | UpdateKeyValueDto) {
    console.log(dto);
    
    return this.keyValueService.createOrUpdate(dto);
  }
  @Delete(':id')
  @RequirePermission(PermissionCode.DELETE_KEY_VALUE)
  async delete(@Param('id') id: string) {
    return this.keyValueService.delete(Number(id));
  }

  @Get('query')
  @RequirePermission(PermissionCode.SHOW_KEY_VALUE_LIST)
  async query(@Query() conditions: Record<string, any>) {
    return this.keyValueService.findAll(conditions);
  }
}