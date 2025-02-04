import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class KeyValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'type', type: 'varchar',length: 255,nullable:true }) // 处理保留字
  type: string;

  @Column({ name: 'key', type: 'varchar',length: 255,nullable:true }) // 处理保留字
  key: string;

  @Column('json') // 自动处理JSON格式
  value: any;

  @Column({name:'desc' ,nullable:true})
  desc: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}