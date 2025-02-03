import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    OneToMany, 
    ManyToOne, 
    CreateDateColumn, 
    UpdateDateColumn 
} from 'typeorm';
import { Achievement } from '../achievements/achievement.entity';

/**
 * 枚举类型，定义成果类型的状态
 */
export enum TypeStatus {
    ACTIVE = 'Active',     // 启用
    INACTIVE = 'Inactive', // 禁用
}

@Entity()
export class AchievementType {
    /**
     * 主键，自增ID
     */
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * 成果类型名称，必须唯一
     */
    @Column({ unique: true, nullable: false })
    name: string;

    /**
     * 成果类型的详细描述，提供更多信息
     */
    @Column({ type: 'text', nullable: true })
    description: string;

    /**
     * 内部标识符，用于系统内部引用或与其他系统集成
     * 例如，使用固定的代码便于数据迁移和映射
     */
    // @Column({ unique: true, nullable: true })
    // code: string;

    /**
     * 成果类型的层级结构，指向其父类型
     * 允许类型具有多层次的分类，如“论文”下的“期刊论文”、“会议论文”等
     */
    @ManyToOne(() => AchievementType, type => type.subTypes, { nullable: true, onDelete: 'SET NULL' })
    parentType: AchievementType;

    /**
     * 子成果类型，支持一对多的层级关系
     */
    @OneToMany(() => AchievementType, type => type.parentType)
    subTypes: AchievementType[];

    /**
     * 成果类型的显示顺序，用于前端展示时的排序
     * 默认值为0，数值越小优先级越高
     */
    @Column({ type: 'int', default: 0, nullable: false })
    order: number;

    /**
     * 成果类型的状态，表示该类型是否处于启用状态
     * 默认值为ACTIVE
     */
    @Column({
        type: 'enum',
        enum: TypeStatus,
        default: TypeStatus.ACTIVE,
        nullable: false
    })
    status: TypeStatus;

    /**
     * 创建时间，自动记录
     */
    @CreateDateColumn()
    createdAt: Date;

    /**
     * 更新时间，自动记录
     */
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Achievement, achievement => achievement.type)
    achievements: Achievement[];
}
