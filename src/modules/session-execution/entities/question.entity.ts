import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Answer } from './answer.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn({ name: 'id_question', type: 'bigint' })
  idQuestion: number;

  @Column({ type: 'text', nullable: false })
  content: string;

  @OneToMany(() => Answer, (answer) => answer.question)
  answers: Answer[];
}
