import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TutorImpartSubject } from './tutor-subject.entity';
import { StudentInterestedSubject } from './student-subject.entity';
import { Session } from '../../scheduling/entities/session.entity';

@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid', { name: 'id_subject' })
  idSubject: string;

  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
