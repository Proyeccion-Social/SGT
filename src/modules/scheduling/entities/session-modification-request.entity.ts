// src/scheduling/entities/session-modification-request.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';
import { User } from '../../users/entities/user.entity';

import { ModificationStatus } from '../enums/modification-status.enum';
import { Modality } from 'src/modules/availability/enums/modality.enum';

@Entity('session_modification_requests')
export class SessionModificationRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'id_request' })
  idRequest: string;

  @Column({ name: 'id_session', type: 'uuid' })
  idSession: string;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  // Cambios propuestos
  @Column({ name: 'new_scheduled_date', type: 'date', nullable: true })
  newScheduledDate?: Date;

  @Column({ name: 'new_start_time', type: 'time', nullable: true })
  newStartTime?: string;

  @Column({ name: 'new_availability_id', type: 'bigint', nullable: true })
  newAvailabilityId?: number;

  @Column({
    name: 'new_modality',
    type: 'enum',
    enum: Modality,
    nullable: true,
  })
  newModality?: Modality;

  @Column({
    name: 'new_duration_hours',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  newDurationHours?: number;

  @Column({
    type: 'enum',
    enum: ModificationStatus,
    default: ModificationStatus.PENDING,
  })
  status: ModificationStatus;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamp' })
  requestedAt: Date;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt?: Date;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedBy?: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date; // 24h después de requestedAt

  // Relaciones
  @ManyToOne(() => Session, (session) => session.modificationRequests)
  @JoinColumn({ name: 'id_session' })
  session: Session;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requester: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'responded_by' })
  responder: User;
}
