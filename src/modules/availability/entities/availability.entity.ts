import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TutorHaveAvailability } from './tutor-availability.entity';
import { ScheduledSession } from '../../scheduling/entities/scheduled-session.entity';

@Entity('availability')
export class Availability {
  @PrimaryGeneratedColumn({ name: 'id_availability', type: 'bigint' })
  idAvailability: number;

  @Column({
    name: 'day_of_week',
    type: 'smallint',
    nullable: false,
  })
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time', nullable: false })
  startTime: string;

  @OneToMany(
    () => TutorHaveAvailability,
    (tutorHaveAvailability) => tutorHaveAvailability.availability,
  )
  tutorHaveAvailabilities: TutorHaveAvailability[];

  @OneToMany(
    () => ScheduledSession,
    (scheduledSession) => scheduledSession.availability,
  )
  scheduledSessions: ScheduledSession[];
}
