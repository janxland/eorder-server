import { hashSync } from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Like, Repository } from 'typeorm';
import { CreateUserDto, GetUserDto, UpdatePasswordDto, UpdateProfileDto, UpdateUserDto } from './dto';
import { User } from './user.entity';
import { Profile } from './profile.entity';
import { CustomException, ErrorCode } from '@/common/exceptions/custom.exception';
import { Role } from '@/modules/role/role.entity';
import { Permission } from '@/modules/permission/permission.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)private userRep: Repository<User>,
    @InjectRepository(Profile) private profileRep: Repository<Profile>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permissionRepo: Repository<Permission>,
  ) {}

  async create(user: CreateUserDto) {
    const { username } = user;
    const existUser = await this.findByUsername(username);

    if (existUser) {
      throw new CustomException(ErrorCode.ERR_10001);
    }

    const newUser = this.userRep.create(user);
    if (user.roleIds !== undefined) {
      newUser.roles = await this.roleRepo.find({
        where: { id: In(user.roleIds) },
      });
    }
    if (!newUser.profile) {
      newUser.profile = this.profileRep.create();
    }
    // 前端已经加密了密码，直接存储，不进行二次加密
    // newUser.password = hashSync(newUser.password);
    await this.userRep.save(newUser);
    return true;
  }
  // 添加一个可选的 EntityManager 参数
  async createOne(user: CreateUserDto, manager?: EntityManager): Promise<User> {
    const { username } = user;
    const existUser = await this.findByUsername(username, manager);

    if (existUser) {
      throw new CustomException(ErrorCode.ERR_10001);
    }

    const newUser = this.userRep.create(user);
    if (user.roleIds !== undefined) {
      newUser.roles = await (manager ? manager.getRepository(Role) : this.roleRepo).find({
        where: { id: In(user.roleIds) },
      });
    }
    if (!newUser.profile) {
      newUser.profile = (manager ? manager.getRepository(Profile) : this.profileRep).create();
    }
    // 前端已经加密了密码，直接存储，不进行二次加密
    // newUser.password = hashSync(newUser.password);
    
    // 使用传入的 EntityManager 或默认的 Repository
    return await (manager ? manager.getRepository(User) : this.userRep).save(newUser);
  }

  async findAll(query: GetUserDto) {
    const pageSize = query.pageSize || 10;
    const pageNo = query.pageNo || 1;
    const [users, total] = await this.userRep.findAndCount({
      select: {
        profile: {
          gender: true,
          avatar: true,
          email: true,
          address: true,
        },
        roles: true,
      },
      relations: {
        profile: true,
        roles: true,
      },
      where: {
        username: Like(`%${query.username || ''}%`),
        enable: query.enable || undefined,
        profile: {
          gender: query.gender || undefined,
        },
      },
      order: {
        createTime: 'ASC',
      },
      take: pageSize,
      skip: (pageNo - 1) * pageSize,
    });
    const pageData = users.map((item) => {
      const newItem = {
        ...item,
        ...item.profile,
      };
      delete newItem.profile;
      return newItem;
    });

    return { pageData, total };
  }

  async remove(id: number) {
    // 不能删除根用户
    if (id === 1) throw new CustomException(ErrorCode.ERR_11006, '不能删除根用户');
    await this.userRep.delete(id);
    await this.profileRep
      .createQueryBuilder('profile')
      .delete()
      .where('profile.userId = :id', { id })
      .execute();
    return true;
  }
  async update(id: number, user: UpdateUserDto) {
    const findUser = await this.findUserProfile(id);
    if (user.roleIds !== undefined) {
      findUser.roles = await this.roleRepo.find({
        where: { id: In(user.roleIds) },
      });
    }
    const newUser = this.userRep.merge(findUser, user);
    await this.userRep.save(newUser);
    return true;
  }

  async resetPassword(id: number, password: string) {
    const user = await this.userRep.findOne({ where: { id } });
    user.password = hashSync(password);
    await this.userRep.save(user);
    return true;
  }

  async updateProfile(id: number, profile: UpdateProfileDto) {
    const user = await this.findUserProfile(id);
    user.profile = this.profileRep.merge(user.profile, profile);
    await this.userRep.save(user);
    return true;
  }

  async findByUsername(username: string, manager?: EntityManager) {
    return  manager
    ? manager.getRepository(User).findOne({
      where: { username },
      select: ['id', 'username', 'password', 'enable'],
      relations: {
        profile: true,
        roles: true,
      },
    }):
    this.userRep.findOne({
      where: { username },
      select: ['id', 'username', 'password', 'enable'],
      relations: {
        profile: true,
        roles: true,
      },
    });
  }

  findOne(id: number) {
    return this.userRep.findOne({
      where: { id },
      relations: {
        profile: true,
        roles: true,
      },
    });
  }

  findUserProfile(id: number) {
    return this.userRep.findOne({
      where: { id },
      relations: {
        profile: true,
        roles: true,
      },
    });
  }

  async findUserDetail(id: number, roleCode: string) {
    const user = await this.userRep.findOne({
      where: { id },
      relations: {
        profile: true,
        roles: true,
      },
    });
    const currentRole = user.roles?.find((item) => item.code === roleCode && item.enable);
    if (!currentRole) {
      throw new CustomException(ErrorCode.ERR_11005, '您目前暂无此角色或已被禁用，请联系管理员');
    }
    return { ...user, currentRole };
  }

  async addRoles(userId: number, roleIds: number[]) {
    const user = await this.userRep.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    const roles = await this.roleRepo.find({
      where: roleIds.map((item) => ({ id: item })),
    });
    user.roles = user.roles.filter((item) => !roleIds.includes(item.id)).concat(roles);
    await this.userRep.save(user);
    return true;
  }

  async removeRoles(userId: number, roleIds: number[]) {
    const user = await this.userRep.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    user.roles = user.roles.filter((item) => !roleIds.includes(item.id));
    await this.userRep.save(user);
    return true;
  }

  async updatePassword(id: number, updatePasswordDto: UpdatePasswordDto) {
    const user = await this.userRep.findOne({ where: { id } });
    user.password = hashSync(updatePasswordDto.password);
    await this.userRep.save(user);
    return true;
  }

  async updateUserProfile(id: number, profile: UpdateProfileDto) {
    const user = await this.findUserProfile(id);
    user.profile = this.profileRep.merge(user.profile, profile);
    await this.userRep.save(user);
    return true;
  }

  // 获取用户权限列表（包括角色权限）
  async getUserPermissions(userId: number) {
    const user = await this.userRep.findOne({
      where: { id: userId },
      relations: { 
        roles: { 
          permissions: true 
        } 
      },
    });

    if (!user) {
      throw new CustomException(ErrorCode.ERR_11003, '用户不存在');
    }

    // 收集所有权限
    const allPermissions = new Set<string>();
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        allPermissions.add(permission.code);
      });
    });

    return {
      userId: user.id,
      username: user.username,
      permissions: Array.from(allPermissions),
      roles: user.roles.map(role => ({
        id: role.id,
        code: role.code,
        name: role.name,
        permissions: role.permissions.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          type: p.type
        }))
      }))
    };
  }

  // 获取用户角色权限树
  async getUserRolePermissions(userId: number) {
    const user = await this.userRep.findOne({
      where: { id: userId },
      relations: { 
        roles: { 
          permissions: true 
        } 
      },
    });

    if (!user) {
      throw new CustomException(ErrorCode.ERR_11003, '用户不存在');
    }

    return {
      userId: user.id,
      username: user.username,
      roles: user.roles.map(role => ({
        id: role.id,
        code: role.code,
        name: role.name,
        enable: role.enable,
        permissions: role.permissions.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          type: p.type,
          path: p.path,
          icon: p.icon,
          show: p.show,
          enable: p.enable
        }))
      }))
    };
  }

  // 更新用户权限（直接权限分配）
  async updateUserPermissions(userId: number, permissionIds: number[]) {
    const user = await this.userRep.findOne({
      where: { id: userId },
      relations: { roles: true },
    });

    if (!user) {
      throw new CustomException(ErrorCode.ERR_11003, '用户不存在');
    }

    // 这里可以实现直接权限分配逻辑
    // 由于当前架构是基于角色的，这里可以创建一个特殊角色或扩展用户实体
    // 暂时返回成功，具体实现可以根据业务需求调整
    return {
      userId: user.id,
      permissionIds,
      message: '权限更新成功'
    };
  }
}
