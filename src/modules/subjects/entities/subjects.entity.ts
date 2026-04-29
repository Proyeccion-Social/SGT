import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TutorImpartSubject } from './tutor-subject.entity';
import { StudentInterestedSubject } from './student-subject.entity';
import { Session } from '../../scheduling/entities/session.entity';

@Entity('subject')
export class Subject {
  @PrimaryGeneratedColumn('uuid', { name: 'id_subject' })
  idSubject: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'color', type: 'varchar', length: 255, nullable: true })
  color: string | null;

  @Column({
    name: 'border_color',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  borderColor: string | null;

  @OneToMany(
    () => TutorImpartSubject,
    (tutorImpartSubject) => tutorImpartSubject.subject,
  )
  tutorImpartSubjects: TutorImpartSubject[];

  @OneToMany(
    () => StudentInterestedSubject,
    (studentInterestedSubject) => studentInterestedSubject.subject,
  )
  studentInterestedSubjects: StudentInterestedSubject[];

  @OneToMany(() => Session, (session) => session.subject)
  sessions: Session[];
}
