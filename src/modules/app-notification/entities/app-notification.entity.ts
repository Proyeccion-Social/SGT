// src/modules/app-notifications/entities/app-notification.entity.ts
 
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
 
/**
 * Tipos de notificación en el sistema.
 * Coinciden con los RF del módulo de scheduling y availability.
 */
export enum AppNotificationType {
  // RF-25 / RF-20: Agendamiento
  SESSION_REQUEST_RECEIVED    = 'SESSION_REQUEST_RECEIVED',    // Al tutor: nueva solicitud
  SESSION_REQUEST_ACK         = 'SESSION_REQUEST_ACK',         // Al estudiante: solicitud enviada
  SESSION_CONFIRMED           = 'SESSION_CONFIRMED',           // A ambos: sesión confirmada
  SESSION_REJECTED            = 'SESSION_REJECTED',            // Al estudiante: solicitud rechazada
 
  // RF-21: Cancelación
  SESSION_CANCELLED           = 'SESSION_CANCELLED',           // A ambos: sesión cancelada
 
  // RF-22: Modificación
  MODIFICATION_REQUEST        = 'MODIFICATION_REQUEST',        // A la contraparte: propuesta recibida
  MODIFICATION_ACCEPTED       = 'MODIFICATION_ACCEPTED',       // Al solicitante: propuesta aceptada
  MODIFICATION_REJECTED       = 'MODIFICATION_REJECTED',       // Al solicitante: propuesta rechazada
  SESSION_DETAILS_UPDATED     = 'SESSION_DETAILS_UPDATED',     // A ambos: título/descripción actualizados
 
  // RF-26: Recordatorios
  SESSION_REMINDER_24H        = 'SESSION_REMINDER_24H',        // A ambos: sesión en 24h
  SESSION_REMINDER_2H         = 'SESSION_REMINDER_2H',         // A ambos: sesión en 2h
 
  // RF-27: Evaluación
  EVALUATION_PENDING          = 'EVALUATION_PENDING',          // Al estudiante: califica tu sesión
  EVALUATION_REMINDER         = 'EVALUATION_REMINDER',         // Al estudiante: recordatorio de calificación
 
  // RF-28: Disponibilidad
  AVAILABILITY_CHANGED        = 'AVAILABILITY_CHANGED',        // Al estudiante: cambio de disponibilidad
 
  // RF-29: Límite de horas
  HOUR_LIMIT_ALERT            = 'HOUR_LIMIT_ALERT',            // Al tutor: alerta de límite semanal
}
 
@Entity('app_notifications')
@Index(['userId', 'createdAt'])   // Consulta principal: notificaciones de un usuario ordenadas
@Index(['userId', 'read'])        // Consulta secundaria: contar/filtrar no leídas
@Index(['createdAt'])             // Job de limpieza: borrar las antiguas eficientemente
export class AppNotification {
 
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  /**
   * Usuario destinatario de la notificación.
   * No es una FK con relación para evitar joins en consultas frecuentes
   * y porque las notificaciones se eliminan sin afectar al usuario.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
 
  @Column({
    type: 'enum',
    enum: AppNotificationType,
  })
  type: AppNotificationType;
 
  /**
   * Texto legible listo para mostrar en el panel.
   * Ejemplo: "Carlos Pérez propuso modificar tu sesión de Cálculo Diferencial"
   * Máximo 300 caracteres — suficiente para cualquier mensaje del sistema.
   */
  @Column({ type: 'varchar', length: 300 })
  message: string;
 
  /**
   * Datos mínimos para que el frontend construya el deep link o realice
   * una acción directa (aceptar/rechazar) sin consultas adicionales.
   * Siempre incluye sessionId cuando aplica.
   * Ejemplos:
   *   { sessionId: "uuid" }
   *   { sessionId: "uuid", requestId: "uuid" }
   *   { sessionId: "uuid", alertLevel: "80_PERCENT" }
   */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, string> | null;
 
  /**
   * false = no leída (punto azul en el panel)
   * true  = ya vista por el usuario
   */
  @Column({ type: 'boolean', default: false })
  read: boolean;
 
  @CreateDateColumn({name:"created_at"})
  createdAt: Date;
}
 