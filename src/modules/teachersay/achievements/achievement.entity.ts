import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    ManyToOne, 
    ManyToMany, 
    JoinTable, 
    CreateDateColumn, 
    UpdateDateColumn 
} from 'typeorm';
import { AchievementType } from '../achievement-types/achievement-type.entity';
import { Teacher } from '../teachers/teacher.entity';
import { User } from '@/modules/user/user.entity';
/**
 * 枚举类型，定义成果的审核状态
 */
export enum AchievementStatus {
    PENDING = 'Pending',     // 待审核
    APPROVED = 'Approved',   // 已批准
    REJECTED = 'Rejected',   // 已拒绝
}

@Entity()
export class Achievement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    achievementCode: string;

    @Column({ nullable: true })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @ManyToOne(() => AchievementType, type => type.achievements, { eager: true, nullable: true })
    type: AchievementType;

    // 作者列表，不需要 @JoinTable()，因为已在 Teacher 实体中定义
    @ManyToMany(() => Teacher, (teacher) => teacher.achievements, { eager: true, nullable: true })
    authors: Teacher[];

    @Column({ type: 'date', nullable: true })
    publishedDate: Date;

    @Column({
        type: 'enum',
        enum: AchievementStatus,
        default: AchievementStatus.PENDING,
        nullable: true
    })
    status: AchievementStatus;

    @Column({ nullable: true })
    level: string;

    @Column({ nullable: true })
    department: string;

    @Column({ nullable: true })
    keywords: string;

    @Column({ type: 'int', nullable: true })
    citationCount: number;

    @Column({ nullable: true })
    link: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    fundingAmount: number;

    @Column({ type: 'date', nullable: true })
    completionDate: Date;

    @Column({ nullable: true })
    attachments: string;

    // 负责人关联，无需 @JoinTable()
    @ManyToOne(() => Teacher, { nullable: true, eager: true })
    responsibleUser: Teacher;

    // 移除团队成员的关系
    // @ManyToMany(() => Teacher, (teacher) => teacher.teamMemberAchievements, { eager: true, nullable: true })
    // teamMembers: Teacher[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}