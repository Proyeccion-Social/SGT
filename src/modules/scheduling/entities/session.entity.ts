// src/scheduling/entities/session.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { Subject } from '../../subjects/entities/subjects.entity';
import { StudentParticipateSession } from './student-participate-session.entity';
import { ScheduledSession } from './scheduled-session.entity';
import { SessionModificationRequest } from './session-modification-request.entity';
import { SessionType } from '../enums/session-type.enum';
import { SessionStatus } from '../enums/session-status.enum';
import { Modality } from 'src/modules/availability/enums/modality.enum';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid', { name: 'id_session' })
  idSession: string;

  @Column({ name: 'id_tutor', type: 'uuid' })
  idTutor: string;

  @Column({ name: 'id_subject', type: 'uuid' })
  idSubject: string;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  // Información de la sesión
  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: SessionType })
  type: SessionType;

  @Column({ type: 'enum', enum: Modality })
  modality: Modality;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.SCHEDULED })
  status: SessionStatus;

  // Campos de cancelación
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'cancelled_within_24h', type: 'boolean', default: false })
  cancelledWithin24h: boolean;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  // Nuevos campos para confirmación por parte del tutor
  @Column({ name: 'tutor_confirmed', type: 'boolean', default: false })
  tutorConfirmed: boolean;

  @Column({ name: 'tutor_confirmed_at', type: 'timestamp', nullable: true })
  tutorConfirmedAt?: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt?: Date;

  // Relaciones
  @ManyToOne(() => Tutor, (tutor) => tutor.sessions)
  @JoinColumn({ name: 'id_tutor' })
  tutor: Tutor;

  @ManyToOne(() => Subject, (subject) => subject.sessions)
  @JoinColumn({ name: 'id_subject' })
  subject: Subject;

  @OneToMany(
    () => StudentParticipateSession,
    (participation) => participation.session,
  )
  studentParticipateSessions: StudentParticipateSession[];

  @OneToOne(() => ScheduledSession, (scheduled) => scheduled.session)
  scheduledSession: ScheduledSession;

  @OneToMany(
    () => SessionModificationRequest,
    (modification) => modification.session,
  )
  modificationRequests: SessionModificationRequest[];
}