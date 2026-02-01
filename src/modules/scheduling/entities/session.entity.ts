import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { Subject } from '../../subjects/entities/subjects.entity';
import { StudentParticipateSession } from './student_participate_session';
import { ScheduledSession } from './scheduled-session.entity';

export enum SessionType {
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP',
}

export enum SessionModality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn({ name: 'id_session', type: 'bigint' })
  idSession: number;

  @Column({ name: 'id_tutor', type: 'bigint', nullable: false })
  idTutor: number;

  @Column({ name: 'id_subject', type: 'bigint', nullable: false })
  idSubject: number;

  @Column({ name: 'scheduled_date', type: 'date', nullable: false })
  scheduledDate: Date;

  @Column({ name: 'start_time', type: 'time', nullable: false })
  startTime: string;

  @Column({ name: 'end_time', type: 'time', nullable: false })
  endTime: string;

  @Column({
    type: 'enum',
    enum: SessionType,
    nullable: true,
  })
  type: SessionType;

  @Column({
    type: 'enum',
    enum: SessionModality,
    nullable: true,
  })
  modality: SessionModality;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    nullable: true,
  })
  status: SessionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Tutor, (tutor) => tutor.sessions)
  @JoinColumn({ name: 'id_tutor' })
  tutor: Tutor;

  @ManyToOne(() => Subject, (subject) => subject.sessions)
  @JoinColumn({ name: 'id_subject' })
  subject: Subject;

  @OneToMany(
    () => StudentParticipateSession,
    (studentParticipateSession) => studentParticipateSession.session,
  )
  studentParticipateSessions: StudentParticipateSession[];

  @OneToOne(
    () => ScheduledSession,
    (scheduledSession) => scheduledSession.session,
  )
  scheduledSession: ScheduledSession;
}
