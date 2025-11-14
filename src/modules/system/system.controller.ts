import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Patch,
    UseGuards
  } from '@nestjs/common';
  import { SystemService } from './system.service';
  import { System } from './system.entity';
  import { CreateSystemDto, UpdateSystemDto } from './dto';
  import { AuthCenterGuard } from '@/common/guards/auth-center.guard';
  import { PermissionCodeGuard } from '@/common/guards/permission-code.guard';
  import { RequirePermission } from '@/common/decorators/permission.decorator';
  import { PermissionCode } from '@/common/enums/permission-code.enum';
  
  @Controller('systems')
  @UseGuards(AuthCenterGuard, PermissionCodeGuard)
  export class SystemController {
    constructor(private readonly systemService: SystemService) {}
  
    @Get()
    @RequirePermission(PermissionCode.SHOW_SYSTEM_LIST)
    async findAll(): Promise<System[]> {
      return this.systemService.findAll();
    }
  
    @Get(':id')
    @RequirePermission(PermissionCode.SHOW_SYSTEM_DETAIL)
    async findOne(@Param('id') id: string): Promise<System> {
      return this.systemService.findOne(Number(id));
    }
  
    @Post()
    @RequirePermission(PermissionCode.CREATE_SYSTEM)
    async create(@Body() systemData: CreateSystemDto): Promise<System> {
      return this.systemService.create(systemData);
    }
  
    @Patch(':id')
    @RequirePermission(PermissionCode.UPDATE_SYSTEM)
    async update(
      @Param('id') id: string,
      @Body() updateData: UpdateSystemDto
    ): Promise<System> {
      return this.systemService.update(Number(id), updateData);
    }
  
    @Delete(':id')
    @RequirePermission(PermissionCode.DELETE_SYSTEM)
    async delete(@Param('id') id: string): Promise<void> {
      return this.systemService.delete(Number(id));
    }
  }