import{
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { UserRole } from '../enums';
import { UserStatus } from '../enums';
import { EmailConfirmation } from './email-confirmation.entity';

@Entity("users")
@Index(["email"], { unique: true })
export class User{
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "full_name", type: "varchar"})
    name: string;

    @Column({ type: "varchar", length: 225, unique: true })
    email: string;

    @Column({ name: "password_hash", type: "varchar", length: 255 })
    passwordHash: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT, })
    role: UserRole;

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING, })
    status: UserStatus;

    @Column({ name: "email_verified", type: "boolean", default: false})
    emailVerified: boolean;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    @OneToMany(() => EmailConfirmation, (emailConfirmation) => emailConfirmation.user, )
    emailConfirmations: EmailConfirmation[];

}