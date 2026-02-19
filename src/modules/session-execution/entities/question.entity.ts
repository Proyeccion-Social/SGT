import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Answer } from './answer.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid', { name: 'id_question' })
  idQuestion: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @OneToMany(() => Answer, (answer) => answer.question)
  answers: Answer[];
}
