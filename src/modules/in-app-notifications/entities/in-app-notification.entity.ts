// src/modules/in-app-notifications/entities/in-app-notification.entity.ts
//
// Diseño deliberadamente mínimo: NO se persiste el texto del mensaje.
// El contenido legible se genera dinámicamente en InAppNotificationsService
// cruzando (type + referenceId) con los datos de dominio actuales.
// Solo persistimos el evento, a quién le pertenece, y si ya lo leyó.
 
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';
 
@Entity('in_app_notifications')
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  // ── A quién pertenece esta notificación ───────────────────────────────────
  @Index()
  @Column({ name: 'user_id' })
  userId: string;
 
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
 
  // ── Qué tipo de evento es ────────────────────────────────────────────────
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;
 
  // ── Referencia al recurso de dominio implicado ───────────────────────────
  // Para eventos de sesión: el UUID de la sesión
  // Para eventos de cuenta: el UUID del usuario
  // Para alertas de horas: el UUID del tutor
  // Permite al frontend construir el link de navegación directa
  @Column({ name: 'reference_id', nullable: true })
  referenceId: string | null;
 
  // Tipo del recurso referenciado, para que el frontend sepa a dónde navegar
  // Ej: 'session', 'modification_request', 'user'
  @Column({ name: 'reference_type', nullable: true })
  referenceType: string | null;
 
  // ── Estado de lectura ────────────────────────────────────────────────────
  @Index()
  @Column({ name: 'is_read', default: false })
  isRead: boolean;
 
  // ── Cuándo ocurrió el evento ─────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
 
  // TTL gestionado por cron job: elimina registros con createdAt < now - 7 días
  // No se usa una columna expiresAt para mantener la tabla mínima.
}
 