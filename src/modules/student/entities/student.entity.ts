import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StudentInterestedSubject } from '../../subjects/entities/student-subject.entity';
import { StudentParticipateSession } from '../../scheduling/entities/student_participate_session';

export enum PreferredModality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}

@Entity('students')
export class Student {
  @PrimaryColumn({ name: 'id_user', type: 'bigint' })
  idUser: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  career: string;

  @Column({
    name: 'preferred_modality',
    type: 'enum',
    enum: PreferredModality,
    nullable: true,
  })
  preferredModality: PreferredModality;

  @OneToOne(() => User, (user) => user.student)
  @JoinColumn({ name: 'id_user' })
  user: User;

  @OneToMany(
    () => StudentInterestedSubject,
    (studentInterestedSubject) => studentInterestedSubject.student,
  )
  studentInterestedSubjects: StudentInterestedSubject[];

  @OneToMany(
    () => StudentParticipateSession,
    (studentParticipateSession) => studentParticipateSession.student,
  )
  studentParticipateSessions: StudentParticipateSession[];
}
