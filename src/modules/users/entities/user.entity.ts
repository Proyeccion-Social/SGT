import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Student } from '../../student/entities/student.entity';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { EmailConfirmation } from '../../auth/entities/email-confirmation.entity';

export enum UserRole {
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'id_user', type: 'bigint' })
  idUser: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: false, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    nullable: false,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    nullable: false,
  })
  status: UserStatus;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToOne(() => Student, (student) => student.user)
  student: Student;

  @OneToOne(() => Tutor, (tutor) => tutor.user)
  tutor: Tutor;

  @OneToMany(() => EmailConfirmation, (emailConfirmation) => emailConfirmation.user)
  emailConfirmations: EmailConfirmation[];
}
