import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from '../../student/entities/student.entity';
import { Session } from './session.entity';
import { Answer } from '../../session-execution/entities/answer.entity';
import { OneToMany } from 'typeorm';

export enum ParticipationStatus {
  REGISTERED = 'REGISTERED',
  ATTENDED = 'ATTENDED',
  ABSENT = 'ABSENT',
  CANCELLED = 'CANCELLED',
}

@Entity('student_participate_session')
export class StudentParticipateSession {
  @PrimaryColumn({ name: 'id_student', type: 'bigint' })
  idStudent: number;

  @PrimaryColumn({ name: 'id_session', type: 'bigint' })
  idSession: number;

  @Column({
    type: 'enum',
    enum: ParticipationStatus,
    nullable: true,
  })
  status: ParticipationStatus;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => Student, (student) => student.studentParticipateSessions)
  @JoinColumn({ name: 'id_student' })
  student: Student;

  @ManyToOne(() => Session, (session) => session.studentParticipateSessions)
  @JoinColumn({ name: 'id_session' })
  session: Session;

  @OneToMany(() => Answer, (answer) => answer.studentParticipateSession)
  answers: Answer[];
}
