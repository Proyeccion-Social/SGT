import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Student } from '../../student/entities/student.entity';
import { Subject } from './subjects.entity';

@Entity('student_interested_subject')
export class StudentInterestedSubject {
  @PrimaryColumn({ name: 'id_student', type: 'bigint' })
  idStudent: number;

  @PrimaryColumn({ name: 'id_subject', type: 'bigint' })
  idSubject: number;

  @ManyToOne(() => Student, (student) => student.studentInterestedSubjects)
  @JoinColumn({ name: 'id_student' })
  student: Student;

  @ManyToOne(() => Subject, (subject) => subject.studentInterestedSubjects)
  @JoinColumn({ name: 'id_subject' })
  subject: Subject;
}
