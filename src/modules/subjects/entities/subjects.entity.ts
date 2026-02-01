import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TutorImpartSubject } from './tutor-subject.entity';
import { StudentInterestedSubject } from './student-subject.entity';
import { Session } from '../../scheduling/entities/session.entity';

@Entity('subject')
export class Subject {
  @PrimaryGeneratedColumn({ name: 'id_subject', type: 'bigint' })
  idSubject: number;

  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  name: string;

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
