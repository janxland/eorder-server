import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Patch
  } from '@nestjs/common';
  import { SystemService } from './system.service';
  import { System } from './system.entity';
  import { CreateSystemDto, UpdateSystemDto } from './dto';
  
  @Controller('systems')
  export class SystemController {
    constructor(private readonly systemService: SystemService) {}
  
    @Get()
    async findAll(): Promise<System[]> {
      return this.systemService.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<System> {
      return this.systemService.findOne(Number(id));
    }
  
    @Post()
    async create(@Body() systemData: CreateSystemDto): Promise<System> {
      return this.systemService.create(systemData);
    }
  
    @Patch(':id')
    async update(
      @Param('id') id: string,
      @Body() updateData: UpdateSystemDto
    ): Promise<System> {
      return this.systemService.update(Number(id), updateData);
    }
  
    @Delete(':id')
    async delete(@Param('id') id: string): Promise<void> {
      return this.systemService.delete(Number(id));
    }
  }