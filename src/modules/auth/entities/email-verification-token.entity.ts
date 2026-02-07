// src/auth/entities/email-verification-token.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id_token: string;

  @Column({ type: 'uuid' })
  id_user: string;

  @Column({ type: 'varchar', length: 255 })
  token_hash: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date | null;

  // Relación con User
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_user' })
  user: User;
}