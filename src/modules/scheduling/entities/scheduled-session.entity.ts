import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Column,
} from 'typeorm';
import { Session } from './session.entity';
import { Availability } from '../../availability/entities/availability.entity';
import { Tutor } from '../../tutor/entities/tutor.entity';

@Entity('scheduled_sessions')
export class ScheduledSession {
  @PrimaryColumn({ name: 'id_tutor', type: 'bigint' })
  idTutor: number;

  @PrimaryColumn({ name: 'id_availability', type: 'bigint' })
  idAvailability: number;

  @Column({ name: 'id_session', type: 'bigint', nullable: true })
  idSession: number;

  @ManyToOne(() => Tutor)
  @JoinColumn({ name: 'id_tutor' })
  tutor: Tutor;

  @ManyToOne(() => Availability)
  @JoinColumn({ name: 'id_availability' })
  availability: Availability;

  @OneToOne(() => Session, (session) => session.scheduledSession)
  @JoinColumn({ name: 'id_session' })
  session: Session;
}
