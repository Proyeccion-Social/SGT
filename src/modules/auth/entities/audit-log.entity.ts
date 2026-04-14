// src/auth/entities/audit-log.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Session } from './session.entity';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REFRESHED = 'SESSION_REFRESHED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id_log: string;

  @Column({ type: 'uuid', nullable: true })
  id_user: string | null;

  @Column({ type: 'uuid', nullable: true })
  id_session: string | null;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditResult,
  })
  result: AuditResult;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_attempted: string | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // Relaciones
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_user' })
  user: User | null;

  @ManyToOne(() => Session, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_session' })
  session: Session | null;
}