import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Question } from './question.entity';
import { StudentParticipateSession } from '../../scheduling/entities/student-participate-session.entity';

@Entity('answers')
export class Answer {
  @PrimaryColumn({ name: 'id_question', type: 'uuid' })
  idQuestion: string;

  @PrimaryColumn({ name: 'id_student', type: 'uuid' })
  idStudent: string;

  @PrimaryColumn({ name: 'id_session', type: 'uuid' })
  idSession: string;

  @Column({
    type: 'smallint',
    nullable: true,
  })
  score: number;

  @Column({ name: 'evaluated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  evaluatedAt: Date;

  @Column({ name: 'questionnaire_version', type: 'varchar', length: 20, default: '1.0' })
  questionnaireVersion: string;

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
