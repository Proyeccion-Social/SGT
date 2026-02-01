import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Question } from './question.entity';
import { StudentParticipateSession } from '../../scheduling/entities/student_participate_session';

@Entity('answers')
export class Answer {
  @PrimaryColumn({ name: 'id_question', type: 'bigint' })
  idQuestion: number;

  @PrimaryColumn({ name: 'id_student', type: 'bigint' })
  idStudent: number;

  @PrimaryColumn({ name: 'id_session', type: 'bigint' })
  idSession: number;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  score: number;

  @ManyToOne(() => Question, (question) => question.answers)
  @JoinColumn({ name: 'id_question' })
  question: Question;

  @ManyToOne(
    () => StudentParticipateSession,
    (studentParticipateSession) => studentParticipateSession.answers,
  )
  @JoinColumn([
    { name: 'id_student', referencedColumnName: 'idStudent' },
    { name: 'id_session', referencedColumnName: 'idSession' },
  ])
  studentParticipateSession: StudentParticipateSession;
}
