// src/modules/in-app-notifications/dto/in-app-notifications.dto.ts
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
 
// ── Respuesta individual ──────────────────────────────────────────────────────
// Lo que el frontend recibe por cada notificación.
// El campo `message` se genera en el servicio, no se lee de BD.
export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  message: string;          // generado dinámicamente
  referenceId: string | null;
  referenceType: string | null;
  isRead: boolean;
  createdAt: Date;
}
 
// ── Respuesta paginada ────────────────────────────────────────────────────────
export class NotificationListResponseDto {
  data: NotificationResponseDto[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
}
 
// ── Query params para GET /notifications ─────────────────────────────────────
export class GetNotificationsQueryDto {
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
 
  @IsOptional()
  page?: number;
}
 
// ── Uso interno: crear una notificación desde NotificationsService ────────────
export class CreateInAppNotificationDto {
  userId: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: string;
}
 