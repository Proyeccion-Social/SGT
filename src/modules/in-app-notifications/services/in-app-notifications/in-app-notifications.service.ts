// src/modules/in-app-notifications/services/in-app-notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { InAppNotification } from '../entities/in-app-notification.entity';
import { NotificationType } from '../enums/notification-type.enum';
import {
  CreateInAppNotificationDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from '../dto/in-app-notifications.dto';
 
const PAGE_SIZE = 20;
const TTL_DAYS  = 7;
 
@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);
 
  constructor(
    @InjectRepository(InAppNotification)
    private readonly repo: Repository<InAppNotification>,
  ) {}
 
  // ═══════════════════════════════════════════════════════════════════════════
  // API pública — llamada desde NotificationsService al lado del email
  // ═══════════════════════════════════════════════════════════════════════════
 
  /**
   * Persiste un evento de notificación in-app.
   * Nunca lanza — un fallo aquí no debe interrumpir el envío del email.
   */
  async create(dto: CreateInAppNotificationDto): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          userId:        dto.userId,
          type:          dto.type,
          referenceId:   dto.referenceId   ?? null,
          referenceType: dto.referenceType ?? null,
          isRead:        false,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error al crear notificación in-app [${dto.type}] para usuario ${dto.userId}: ${error.message}`,
        error.stack,
      );
    }
  }
 
  /**
   * Versión multi-usuario: persiste el mismo evento para varios destinatarios.
   * Útil para cancelaciones, recordatorios y sesiones colaborativas.
   */
  async createForMany(
    userIds: string[],
    dto: Omit<CreateInAppNotificationDto, 'userId'>,
  ): Promise<void> {
    if (!userIds.length) return;
 
    try {
      const entities = userIds.map((userId) =>
        this.repo.create({
          userId,
          type:          dto.type,
          referenceId:   dto.referenceId   ?? null,
          referenceType: dto.referenceType ?? null,
          isRead:        false,
        }),
      );
      await this.repo.save(entities);
    } catch (error) {
      this.logger.error(
        `Error al crear notificaciones in-app en batch [${dto.type}]: ${error.message}`,
        error.stack,
      );
    }
  }
 
  // ═══════════════════════════════════════════════════════════════════════════
  // Consulta — usada por el controller
  // ═══════════════════════════════════════════════════════════════════════════
 
  async getForUser(
    userId: string,
    page: number = 1,
    unreadOnly: boolean = false,
  ): Promise<NotificationListResponseDto> {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
 
    const [notifications, total] = await this.repo.findAndCount({
      where,
      order:  { createdAt: 'DESC' },
      take:   PAGE_SIZE,
      skip:   (page - 1) * PAGE_SIZE,
    });
 
    const unreadCount = await this.repo.count({ where: { userId, isRead: false } });
 
    return {
      data:       notifications.map((n) => this.toResponseDto(n)),
      unreadCount,
      total,
      page,
      pageSize:   PAGE_SIZE,
    };
  }
 
  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones de lectura
  // ═══════════════════════════════════════════════════════════════════════════
 
  /** Marca todas las notificaciones del usuario como leídas. */
  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
  }
 
  /** Marca una notificación individual como leída, validando que pertenece al usuario. */
  async markOneAsRead(notificationId: string, userId: string): Promise<void> {
    await this.repo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }
 
  // ═══════════════════════════════════════════════════════════════════════════
  // Limpieza automática (TTL de 7 días)
  // ═══════════════════════════════════════════════════════════════════════════
 
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TTL_DAYS);
 
    const result = await this.repo.delete({ createdAt: LessThan(cutoff) });
    this.logger.log(
      `Limpieza de notificaciones in-app: ${result.affected ?? 0} registros eliminados (anteriores a ${cutoff.toISOString()})`,
    );
  }
 
  // ═══════════════════════════════════════════════════════════════════════════
  // Generación dinámica del mensaje — aquí vive la lógica híbrida
  // El texto se construye a partir del tipo, nunca se almacena en BD.
  // ═══════════════════════════════════════════════════════════════════════════
 
  private toResponseDto(n: InAppNotification): NotificationResponseDto {
    return {
      id:            n.id,
      type:          n.type,
      message:       this.buildMessage(n.type),
      referenceId:   n.referenceId,
      referenceType: n.referenceType,
      isRead:        n.isRead,
      createdAt:     n.createdAt,
    };
  }
 
  private buildMessage(type: NotificationType): string {
    const messages: Record<NotificationType, string> = {
      // Cuenta
      [NotificationType.ACCOUNT_CREATED]:            'Tu cuenta ha sido creada exitosamente. ¡Bienvenido a Atlas!',
      [NotificationType.PROFILE_COMPLETED]:           'Tu perfil de tutor ha sido completado.',
      [NotificationType.PASSWORD_CHANGED]:            'Tu contraseña fue cambiada. Si no fuiste tú, contacta soporte.',
 
      // Agendamiento
      [NotificationType.SESSION_REQUEST_RECEIVED]:   'Tienes una nueva solicitud de tutoría pendiente de confirmación.',
      [NotificationType.SESSION_REQUEST_SENT]:        'Tu solicitud de tutoría fue enviada y está pendiente de confirmación.',
      [NotificationType.SESSION_CONFIRMED]:           'Una sesión de tutoría ha sido confirmada.',
      [NotificationType.SESSION_REJECTED]:            'Tu solicitud de tutoría no fue aceptada.',
      [NotificationType.SESSION_CANCELLED]:           'Una sesión de tutoría ha sido cancelada.',
      [NotificationType.SESSION_DETAILS_UPDATED]:     'Los detalles de una sesión fueron actualizados.',
      [NotificationType.SESSION_REMINDER]:            'Tienes una sesión de tutoría próxima.',
 
      // Modificaciones
      [NotificationType.MODIFICATION_REQUESTED]:     'Tienes una propuesta de modificación pendiente de respuesta.',
      [NotificationType.MODIFICATION_ACCEPTED]:       'Tu propuesta de modificación fue aceptada.',
      [NotificationType.MODIFICATION_REJECTED]:       'Tu propuesta de modificación fue rechazada.',
 
      // Post-sesión
      [NotificationType.EVALUATION_PENDING]:          'Tienes una sesión completada pendiente de calificación.',
 
      // Disponibilidad
      [NotificationType.AVAILABILITY_CHANGED]:        'Un cambio de disponibilidad de tu tutor afecta una sesión agendada.',
      [NotificationType.HOUR_LIMIT_ALERT]:            'Estás cerca de alcanzar tu límite semanal de horas.',
 
      // Colaborativas
      [NotificationType.COLLABORATIVE_SESSION_OPEN]: 'Hay una nueva sesión colaborativa disponible en una materia de tu interés.',
    };
 
    return messages[type] ?? 'Tienes una nueva notificación.';
  }
}