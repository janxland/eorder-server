/**
 * website: https://www.roginx.ink
 */

import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, length: 10 })
  nickName: string;

  @Column({ nullable: true })
  gender: number;

  @Column({
    default:
      'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80',
  })
  avatar: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  email: string;

  @OneToOne(() => User, (user) => user.profile, {
    createForeignKeyConstraints: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column({ unique: true })
  userId: number;
}
