/**
 * website: https://www.roginx.ink
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission } from './permission.entity';
import { In, Repository } from 'typeorm';
import { SharedService } from '@/shared/shared.service';
import { pathToRegexp } from 'path-to-regexp';

@Injectable()
export class PermissionService {
  constructor(
    private readonly sharedService: SharedService,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}
  create(createPermissionDto: CreatePermissionDto) {
    // 如果未提供 type，默认为 MENU
    if (!createPermissionDto.type) {
      createPermissionDto.type = 'MENU';
    }
    const createPermission = this.permissionRepo.create(createPermissionDto);
    return this.permissionRepo.save(createPermission);
  }

  batchCreate(createPermissionDtos: CreatePermissionDto[]) {
    // 如果未提供 type，默认为 MENU
    createPermissionDtos.forEach(dto => {
      if (!dto.type) {
        dto.type = 'MENU';
      }
    });
    const permissions = this.permissionRepo.create(createPermissionDtos);
    return this.permissionRepo.save(permissions);
  }

  async findAll(queryDto?: { name?: string; type?: string; enable?: boolean | string; page?: number | string; num?: number | string }) {
    // 处理查询参数，转换类型
    const name = queryDto?.name;
    const type = queryDto?.type;
    let enable: boolean | undefined = undefined;
    if (queryDto?.enable !== undefined) {
      enable = queryDto.enable === 'true' || queryDto.enable === true;
    }
    const page = queryDto?.page ? Number(queryDto.page) : 1;
    const num = queryDto?.num ? Number(queryDto.num) : 10;
    
    let queryBuilder = this.permissionRepo.createQueryBuilder('permission');
    
    // 搜索条件
    if (name) {
      queryBuilder = queryBuilder.andWhere('permission.name LIKE :name', { name: `%${name}%` });
    }
    
    if (type) {
      queryBuilder = queryBuilder.andWhere('permission.type = :type', { type });
    }
    
    if (enable !== undefined) {
      queryBuilder = queryBuilder.andWhere('permission.enable = :enable', { enable });
    }
    
    // 排序
    queryBuilder = queryBuilder.orderBy('permission.order', 'ASC');
    
    // 获取总数
    const totalCount = await queryBuilder.getCount();
    
    // 分页
    const skip = (page - 1) * num;
    queryBuilder = queryBuilder.skip(skip).take(num);
    
    // 获取数据
    const data = await queryBuilder.getMany();
    
    // 计算总页数
    const totalPage = Math.ceil(totalCount / num);
    
    return {
      msg: '获取权限列表成功',
      data,
      totalPage,
      totalCount,
      page,
      num
    };
  }

  async findAllTree() {
    const permissions = await this.permissionRepo.find({ order: { order: 'ASC' } });
    return this.sharedService.handleTree(permissions);
  }

  async findMenuTree() {
    const allPermissions = await this.permissionRepo.find({
      order: { order: 'ASC' },
    });
    
    const menuPermissions = allPermissions.filter(p => p.type === 'MENU');
    
    return this.sharedService.handleTree(menuPermissions);
  }

  findOne(id: number) {
    return this.permissionRepo.findOne({ where: { id } });
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) throw new BadRequestException('权限不存在或者已删除');
    
    // 如果更新数据中没有 type，保留原有值
    if (!updatePermissionDto.type && permission.type) {
      updatePermissionDto.type = permission.type;
    }
    
    const newPermission = this.permissionRepo.merge(permission, updatePermissionDto);
    await this.permissionRepo.save(newPermission);
    
    return true;
  }

  /**
   * 递归删除权限及其所有子孙权限
   */
  async remove(id: number) {
    const permission = await this.permissionRepo.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!permission) throw new BadRequestException('权限不存在或者已删除');
    if (permission.roles?.length)
      throw new BadRequestException('当前权限存在已授权的角色，不允许删除！');
    
    // 递归查找所有子权限ID
    const childIds = await this.findAllChildIds(id);
    
    // 检查子权限是否有关联的角色
    if (childIds.length > 0) {
      const childPermissions = await this.permissionRepo.find({
        where: { id: In(childIds) },
        relations: { roles: true },
      });
      const hasRolePermissions = childPermissions.some(p => p.roles?.length);
      if (hasRolePermissions) {
        throw new BadRequestException('存在子权限已授权给角色，不允许删除！');
      }
    }
    
    // 删除所有子权限和当前权限
    const allIds = [id, ...childIds];
    await this.permissionRepo.delete(allIds);
    return true;
  }

  /**
   * 递归查找所有子权限ID（优化版本）
   * 使用单次查询获取所有子权限，减少数据库查询次数
   */
  private async findAllChildIds(parentId: number): Promise<number[]> {
    // 一次性查询所有权限，在内存中构建树形关系
    const allPermissions = await this.permissionRepo.find({
      select: ['id', 'parentId'],
    });
    
    // 构建父子关系映射
    const parentChildrenMap = new Map<number, number[]>();
    for (const perm of allPermissions) {
      if (perm.parentId) {
        if (!parentChildrenMap.has(perm.parentId)) {
          parentChildrenMap.set(perm.parentId, []);
        }
        parentChildrenMap.get(perm.parentId)!.push(perm.id);
      }
    }
    
    // 使用迭代方式收集所有子权限ID
    const allChildIds: number[] = [];
    const stack = [parentId];
    const visited = new Set<number>();
    
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const children = parentChildrenMap.get(currentId);
      if (children && children.length > 0) {
        allChildIds.push(...children);
        stack.push(...children);
      }
    }
    
    return allChildIds;
  }

  /**
   * 获取权限及其所有子权限的扁平数组
   * 便于赋权和批量操作
   */
  async getPermissionWithChildren(id: number): Promise<Permission[]> {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) throw new BadRequestException('权限不存在或者已删除');
    
    const childIds = await this.findAllChildIds(id);
    const allIds = [id, ...childIds];
    
    return this.permissionRepo.find({
      where: { id: In(allIds) },
      order: { order: 'ASC' },
    });
  }

  /**
   * 批量更新权限状态（启用/禁用）
   * 便于批量赋权和权限管理
   */
  async batchUpdateStatus(ids: number[], enable: boolean): Promise<boolean> {
    if (!ids || ids.length === 0) return false;
    
    await this.permissionRepo.update(
      { id: In(ids) },
      { enable }
    );
    
    return true;
  }

  /**
   * 获取权限树（扁平化版本）
   * 便于赋权时快速查找和匹配
   */
  async findAllFlat(): Promise<Permission[]> {
    return this.permissionRepo.find({ 
      order: { order: 'ASC' },
      relations: { roles: true },
    });
  }

  findButton(parentId: number) {
    return this.permissionRepo.find({
      where: { parentId, type: 'BUTTON' },
      order: { order: 'ASC' },
    });
  }

  /**
   * 验证菜单路径是否存在
   * 优化：只查询path字段，减少数据传输
   */
  async validateMenuPath(path: string) {
    const allMenu = await this.permissionRepo.find({
      where: { type: 'MENU' },
      select: ['path'],
    });
    return allMenu.some((menu) => menu.path && pathToRegexp(menu.path).test(path));
  }

  /**
   * 修复所有空 type 的权限
   * 根据权限特征自动推断并设置 type 字段
   */
  async fixEmptyTypes(): Promise<{ fixed: number; details: Array<{ id: number; name: string; code: string; oldType: string; newType: string }> }> {
    const allPermissions = await this.permissionRepo.find();
    const emptyTypePermissions = allPermissions.filter(p => !p.type || p.type.trim() === '');
    
    const fixedDetails: Array<{ id: number; name: string; code: string; oldType: string; newType: string }> = [];
    
    for (const perm of emptyTypePermissions) {
      const inferredType: 'MENU' | 'BUTTON' | 'API' = perm.method ? 'API' : 'MENU';
      const oldType = perm.type || '(空)';
      
      perm.type = inferredType;
      
      fixedDetails.push({
        id: perm.id,
        name: perm.name,
        code: perm.code,
        oldType,
        newType: inferredType,
      });
    }
    
    if (fixedDetails.length > 0) {
      await this.permissionRepo.save(emptyTypePermissions);
    }
    
    return {
      fixed: fixedDetails.length,
      details: fixedDetails,
    };
  }
}
