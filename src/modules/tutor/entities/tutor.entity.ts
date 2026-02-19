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
  @PrimaryColumn({ name: 'id_user', type: 'uuid' })
  idUser: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({
    name: 'limit_disponibility',
    type: 'smallint',
    nullable: true,
  })
  limitDisponibility: number | null;

  @Column({ type: 'boolean', default: false })
  profile_completed: boolean;

  @Column({ name: 'url_image', type: 'text', nullable: true })
  urlImage: string | null;

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
