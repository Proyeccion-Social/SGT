import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Answer } from './answer.entity';

@Entity('questions')
export class Question {
  @PrimaryColumn({ name: 'id_question', type: 'uuid' })
  idQuestion: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @OneToMany(() => Answer, (answer) => answer.question)
  answers: Answer[];
}
