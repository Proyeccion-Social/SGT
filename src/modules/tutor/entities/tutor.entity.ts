import {
  Entity,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TutorImpartSubject } from '../../subjects/entities/tutor-subject.entity';
import { TutorHaveAvailability } from '../../availability/entities/tutor-availability.entity';
import { Session } from '../../scheduling/entities/session.entity';

@Entity('tutors')
export class Tutor {
  @PrimaryColumn({ name: 'id_user', type: 'bigint' })
  idUser: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    name: 'limit_disponibility',
    type: 'smallint',
    nullable: true,
  })
  limitDisponibility: number;

  @Column({ name: 'url_image', type: 'text', nullable: true })
  urlImage: string;

  @OneToOne(() => User, (user) => user.tutor)
  @JoinColumn({ name: 'id_user' })
  user: User;

  @OneToMany(
    () => TutorImpartSubject,
    (tutorImpartSubject) => tutorImpartSubject.tutor,
  )
  tutorImpartSubjects: TutorImpartSubject[];

  @OneToMany(
    () => TutorHaveAvailability,
    (tutorHaveAvailability) => tutorHaveAvailability.tutor,
  )
  tutorHaveAvailabilities: TutorHaveAvailability[];

  @OneToMany(() => Session, (session) => session.tutor)
  sessions: Session[];
}
