import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { Achievement } from '../achievements/achievement.entity';
import { IsOptional } from 'class-validator';
import { Role } from '@/modules/role/role.entity';

@Entity()
export class Teacher {
  @PrimaryColumn()
  id: number; // 共享主键，引用 User 的 id

  @OneToOne(() => User, (user) => user.teacher, { eager: true })
  @JoinColumn()
  user: User;

  @Column({ unique: true, length: 50 })
  name: string;

  @Column({ length: 100, nullable: true })
  department: string; // 部门

  @Column({ length: 100 , default: '讲师' })
  title: string; // 职称，如教授、副教授等

  @Column({ length: 100, nullable: true })
  researchArea?: string; // 研究方向

  @Column({ length: 100, nullable: true })
  office?: string; // 办公室位置

  @Column({ nullable: true })
  phoneNumber?: string; // 联系电话

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  // 教师作为作者关联的成果
  @ManyToMany(() => Achievement, (achievement) => achievement.authors, {
    cascade: true,
  })
  @JoinTable({
    name: 'teacher_authored_achievements', // 自定义连接表名
    joinColumn: {
      name: 'teacherId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'achievementId',
      referencedColumnName: 'id',
    },
  })
  achievements: Achievement[];
  
  @JoinTable()
  roles: Role[];
}
