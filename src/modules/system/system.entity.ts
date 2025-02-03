import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class System {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  code: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  domain: string;

  //系统IP:端口
  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  key: string;

  @Column({ default: true })
  enable: boolean;
}