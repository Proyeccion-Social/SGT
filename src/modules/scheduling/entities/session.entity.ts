// src/modules/scheduling/entities/session.entity.ts
// ÚNICO CAMBIO RESPECTO A LA VERSIÓN ACTUAL:
// Se añade el campo confirmationExpiresAt para que el cron de auto-cancelación
// pueda usar un índice simple en lugar de calcular dinámicamente la fecha límite.
// El valor se precalcula al crear la sesión: scheduledDateTime - 6 horas.
 
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
import { Modality } from '../../availability/enums/modality.enum';
 
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid', { name: 'id_session' })
  idSession: string;
 
  @Column({ name: 'id_tutor', type: 'uuid' })
  idTutor: string;
 
  @Column({ name: 'id_subject', type: 'uuid' })
  idSubject: string;
 
  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: string;
 
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;
 
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
 
  @Column({ type: 'varchar', length: 100 })
  title: string;
 
  @Column({ type: 'text' })
  description: string;
 
  @Column({ type: 'enum', enum: SessionType })
  type: SessionType;
 
  @Column({ type: 'enum', enum: Modality })
  modality: Modality;
 
  @Column({ type: 'varchar', nullable: true })
  location?: string;
 
  @Column({ name: 'virtual_link', type: 'varchar', nullable: true })
  virtualLink?: string;
 
  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status: SessionStatus;
 
  // ─── Nuevo campo ────────────────────────────────────────────────────────
  /**
   * Timestamp hasta el cual el tutor puede confirmar/rechazar la solicitud.
   * Se calcula al crear la sesión como: scheduledDateTime - 6 horas.
   * El cron job consulta WHERE confirmation_expires_at <= NOW()
   * AND status = PENDING_TUTOR_CONFIRMATION para auto-cancelar.
   *
   * Solo es relevante mientras status = PENDING_TUTOR_CONFIRMATION.
   * Una vez confirmada o rechazada, este campo no se usa.
   */
  @Column({ name: 'confirmation_expires_at', type: 'timestamp', nullable: true })
  confirmationExpiresAt?: Date;
  // ────────────────────────────────────────────────────────────────────────
 
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
 
  @Column({ name: 'tutor_confirmed', type: 'boolean', default: false })
  tutorConfirmed: boolean;
 
  @Column({ name: 'tutor_confirmed_at', type: 'timestamp', nullable: true })
  tutorConfirmedAt?: Date;
 
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;
 
  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt?: Date;
 
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