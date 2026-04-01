import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Answer } from './answer.entity';

export enum QuestionAspect {
  CLARITY = 'CLARITY',
  PATIENCE = 'PATIENCE',
  PUNCTUALITY = 'PUNCTUALITY',
  KNOWLEDGE = 'KNOWLEDGE',
}

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid', { name: 'id_question' })
  idQuestion: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ type: 'varchar', length: 30, default: QuestionAspect.CLARITY })
  aspect: QuestionAspect;

  @Column({ type: 'varchar', length: 150, default: '' })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  required: boolean;

  @Column({ name: 'display_order', type: 'smallint', default: 1 })
  displayOrder: number;

  @Column({ name: 'min_score', type: 'smallint', default: 1 })
  minScore: number;

  @Column({ name: 'max_score', type: 'smallint', default: 5 })
  maxScore: number;

  @Column({
    name: 'questionnaire_version',
    type: 'varchar',
    length: 20,
    default: '1.0',
  })
  questionnaireVersion: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Answer, (answer) => answer.question)
  answers: Answer[];
}
