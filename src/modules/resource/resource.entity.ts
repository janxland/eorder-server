import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne } from 'typeorm';
import { User } from '../user/user.entity';

/**
 * 资源管理实体类
 */
@Entity()
export class Resource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileName: string; // 文件名

  @Column({ nullable: true })
  filePath: string; // 文件存储路径（仅用于文件类型）

  @Column({ nullable: true })
  url: string; // 网络资源的 URL（如果是网络资源的话）

  @Column()
  resourceType: string; // 资源类型，表示资源的自定义用途类型（例如：'image', 'document', 'video', 'audio', 'external', 等）

  @Column({ nullable: true })
  description: string; // 描述字段，方便说明该资源的用途

  @Column({ nullable: true })
  md5: string; // 文件的 MD5 哈希值
  
    // 负责人关联，无需 @JoinTable()
  @OneToOne(() => User, { nullable: true, eager: true })
  userId: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
