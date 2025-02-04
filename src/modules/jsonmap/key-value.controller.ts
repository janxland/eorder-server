import { Controller, Get, Post, Delete, Body, Query, Param, Patch } from '@nestjs/common';
import { KeyValueService } from './key-value.service';
import { CreateKeyValueDto, GetKeyValueDto, UpdateKeyValueDto } from './dto';

@Controller('/key-value')
export class KeyValueController {
  constructor(private readonly keyValueService: KeyValueService) {}
  @Get()
  getAll(@Query()  queryDto: GetKeyValueDto){
    return this.keyValueService.findAll(queryDto);
  }
  //只取一个
  @Get("/query")
  async Query(@Query()  queryDto: GetKeyValueDto){
    return (await this.keyValueService.findAll(queryDto)).pageData[0];
  }

  @Post()
  async createOrUpdate(@Body() dto: CreateKeyValueDto | UpdateKeyValueDto) {
    return this.keyValueService.createOrUpdate(dto);
  }
  @Patch(':id')
  async update(@Body() dto: CreateKeyValueDto | UpdateKeyValueDto) {
    console.log(dto);
    
    return this.keyValueService.createOrUpdate(dto);
  }
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.keyValueService.delete(Number(id));
  }

  @Get('query')
  async query(@Query() conditions: Record<string, any>) {
    return this.keyValueService.findAll(conditions);
  }
}