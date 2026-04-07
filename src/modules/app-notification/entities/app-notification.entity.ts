// src/modules/app-notifications/entities/app-notification.entity.ts
 
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
 
export enum AppNotificationType {
  // RF-25 / RF-20: Agendamiento
  SESSION_REQUEST_RECEIVED    = 'SESSION_REQUEST_RECEIVED',
  SESSION_REQUEST_ACK         = 'SESSION_REQUEST_ACK',
  SESSION_CONFIRMED           = 'SESSION_CONFIRMED',
  SESSION_REJECTED            = 'SESSION_REJECTED',
 
  // RF-21: Cancelación
  SESSION_CANCELLED           = 'SESSION_CANCELLED',
 
  // RF-22: Modificación
  MODIFICATION_REQUEST        = 'MODIFICATION_REQUEST',
  MODIFICATION_ACCEPTED       = 'MODIFICATION_ACCEPTED',
  MODIFICATION_REJECTED       = 'MODIFICATION_REJECTED',
  SESSION_DETAILS_UPDATED     = 'SESSION_DETAILS_UPDATED',
 
  // RF-26: Recordatorios
  SESSION_REMINDER_24H        = 'SESSION_REMINDER_24H',
  SESSION_REMINDER_2H         = 'SESSION_REMINDER_2H',
 
  // RF-27: Evaluación
  EVALUATION_PENDING          = 'EVALUATION_PENDING',
  EVALUATION_REMINDER         = 'EVALUATION_REMINDER',
 
  // RF-28: Disponibilidad
  AVAILABILITY_CHANGED        = 'AVAILABILITY_CHANGED',
 
  // RF-29: Límite de horas
  HOUR_LIMIT_ALERT            = 'HOUR_LIMIT_ALERT',
 
  // Session execution: asistencia
  SESSION_ABSENT              = 'SESSION_ABSENT',   // Al estudiante que no asistió
}
 
@Entity('app_notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'read'])
@Index(['createdAt'])
export class AppNotification {
 
  @PrimaryGeneratedColumn('uuid')
  id!: string;
 
  @Column({ type: 'uuid', name: "user_id" })
  userId!: string;
 
  @Column({ type: 'enum', enum: AppNotificationType })
  type!: AppNotificationType;
 
  /**
   * Texto legible listo para mostrar en el panel.
   * Máximo 300 caracteres.
   */
  @Column({ type: 'varchar', length: 300 })
  message!: string;
 
  /**
   * Datos mínimos para que el frontend construya el deep link.
   * Siempre incluye sessionId cuando aplica.
   */
  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, string> | null;
 
  @Column({ type: 'boolean', default: false })
  read!: boolean;
 
  @CreateDateColumn()
  createdAt!: Date;
}