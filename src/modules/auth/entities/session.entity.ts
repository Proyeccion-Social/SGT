import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('auth_sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id_session: string;

  // @Column({ type: 'uuid' }) //Aquí había un error, se estaba intentando usar id_user como columna, pero es una relación con User
  // id_user: string;

  @Column({ type: 'varchar', length: 255 })
  refresh_token_hash: string;

  // @Column({ type: 'varchar', length: 45, nullable: true })
  // ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_activity_at: Date;

  // Relación con User
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_user' })
  user: User;
  startTime: any;
}
