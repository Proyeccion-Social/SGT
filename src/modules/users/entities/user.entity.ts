import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany
} from 'typeorm';
import { Student } from '../../student/entities/student.entity';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { Session} from '../../auth/entities/session.entity';
//import { EmailConfirmation } from '../../auth/entities/email-confirmation.entity';

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
  @PrimaryGeneratedColumn('uuid', { name: 'id_user' })
  idUser: string;

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

  //Nuevos campos 
  @Column({ type: 'timestamp', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  password_changed_at: Date | null;


  //Relaciones

  @OneToOne(() => Student, (student) => student.user)
  student: Student;

  @OneToOne(() => Tutor, (tutor) => tutor.user)
  tutor: Tutor;

 // @OneToMany(() => Session, (session) => session.user) Se elimina la la relación con session pues se estableció que era redundande desde el lado de Session
 // sessions: Session[];

  //@OneToMany(() => EmailConfirmation, (emailConfirmation) => emailConfirmation.user)
  //emailConfirmations: EmailConfirmation[];
}
