import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Column,
  Unique,
} from 'typeorm';
import { Session } from './session.entity';
import { Availability } from '../../availability/entities/availability.entity';
import { Tutor } from '../../tutor/entities/tutor.entity';

@Entity('scheduled_sessions')
@Unique('UQ_tutor_availability_date', ['idTutor', 'idAvailability', 'scheduledDate'])
export class ScheduledSession {
  @Column({ name: 'id_tutor', type: 'uuid' })
  idTutor: string;

  @Column({ name: 'id_availability', type: 'bigint' })
  idAvailability: number;

  @PrimaryColumn({ name: 'id_session', type: 'uuid' }) //eliminé el nullable:true
  idSession: string;

  @Column({ name: 'scheduled_date', type: 'date' }) //nuevo campo para almacenar la fecha programada, necesario para validaciones de disponibilidad
  scheduledDate: string;

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
