import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { Subject } from './subjects.entity';

@Entity('tutor_impart_subject')
export class TutorImpartSubject {
  @PrimaryColumn({ name: 'id_tutor', type: 'uuid' })
  idTutor: string;

  @PrimaryColumn({ name: 'id_subject', type: 'uuid' })
  idSubject: string;

  @ManyToOne(() => Tutor, (tutor) => tutor.tutorImpartSubjects)
  @JoinColumn({ name: 'id_tutor' })
  tutor: Tutor;

  @ManyToOne(() => Subject, (subject) => subject.tutorImpartSubjects)
  @JoinColumn({ name: 'id_subject' })
  subject: Subject;
}
