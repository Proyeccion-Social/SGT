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
  @PrimaryColumn({ name: 'id_tutor', type: 'uuid' })
  idTutor: string;

  @PrimaryColumn({ name: 'id_availability', type: 'uuid' })
  idAvailability: string;

  @Column({ name: 'id_session', type: 'uuid', nullable: true })
  idSession: string;

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
