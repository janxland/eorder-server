import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from './profile.entity';
import { Role } from '@/modules/role/role.entity';
import { Teacher } from '../teachersay/teachers/teacher.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50, nullable: false })
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ default: true })
  enable: boolean;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  @OneToOne(() => Profile, (profile) => profile.user, {
    createForeignKeyConstraints: false,
    cascade: true,
  })
  profile: Profile;

  @ManyToMany(() => Role, (role) => role.users, {
    createForeignKeyConstraints: false,
  })
  @JoinTable()
  roles: Role[];

  @OneToOne(() => Teacher, (teacher) => teacher.user, {
    cascade: true, // 允许级联操作
  })
  teacher: Teacher;
}
