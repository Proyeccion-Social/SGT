// src/modules/app-notifications/services/app-notifications.service.ts
 
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import {
  AppNotification,
  AppNotificationType,
} from '../entities/app-notification.entity';
 
// ─────────────────────────────────────────────────────────────────────────────
// Tipos de entrada
// ─────────────────────────────────────────────────────────────────────────────
 
export interface CreateNotificationInput {
  userId: string;
  type: AppNotificationType;
  message: string;
  payload?: Record<string, string>;
}
 
export interface PaginatedNotifications {
  data: AppNotification[];
  meta: {
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────
 
@Injectable()
export class AppNotificationsService {
  private readonly logger = new Logger(AppNotificationsService.name);
 
  /** Días que se conservan las notificaciones antes de eliminarse. */
  private readonly TTL_DAYS = 7;
 
  constructor(
    @InjectRepository(AppNotification,'local')
    private readonly notificationRepository: Repository<AppNotification>,
  ) {}
 
  // ─────────────────────────────────────────────────────────────────────────
  // Escritura
  // ─────────────────────────────────────────────────────────────────────────
 
  /**
   * Persiste una notificación para un usuario.
   * Se llama desde NotificationsService después (o antes) de enviar el email.
   * Un fallo aquí no debe interrumpir el flujo de negocio — el llamante
   * debe usar try/catch o fireAndLog.
   */
  async create(input: CreateNotificationInput): Promise<AppNotification> {
    const notification = this.notificationRepository.create({
      userId:  input.userId,
      type:    input.type,
      message: input.message,
      payload: input.payload ?? null,
      read:    false,
    });
 
    const saved = await this.notificationRepository.save(notification);
 
    this.logger.debug(
      `Notificación persistida | userId=${input.userId} type=${input.type}`,
    );
 
    return saved;
  }
 
  /**
   * Persiste varias notificaciones en una sola operación (INSERT en batch).
   * Útil cuando un evento genera notificaciones para múltiples usuarios
   * (cancelación, recordatorio, etc.).
   */
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (!inputs.length) return;
 
    const entities = inputs.map((input) =>
      this.notificationRepository.create({
        userId:  input.userId,
        type:    input.type,
        message: input.message,
        payload: input.payload ?? null,
        read:    false,
      }),
    );
 
    await this.notificationRepository.save(entities);
 
    this.logger.debug(
      `${entities.length} notificaciones persistidas en batch`,
    );
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Lectura
  // ─────────────────────────────────────────────────────────────────────────
 
  /**
   * Devuelve las notificaciones de un usuario, más recientes primero.
   * Incluye el conteo de no leídas en la metadata para el badge del panel.
   */
  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
    onlyUnread = false,
  ): Promise<PaginatedNotifications> {
    const offset = (page - 1) * limit;
 
    const whereClause: any = { userId };
    if (onlyUnread) whereClause.read = false;
 
    const [data, total] = await this.notificationRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip:  offset,
      take:  limit,
    });
 
    // Conteo de no leídas (siempre, independiente del filtro onlyUnread)
    const unreadCount = await this.notificationRepository.count({
      where: { userId, read: false },
    });
 
    return {
      data,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages:      Math.ceil(total / limit),
        hasNextPage:     page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Marcar como leída(s)
  // ─────────────────────────────────────────────────────────────────────────
 
  /**
   * Marca una notificación específica como leída.
   * Valida que la notificación pertenezca al usuario solicitante.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
 
    if (!notification) {
      throw new NotFoundException(
        `Notificación ${notificationId} no encontrada`,
      );
    }
 
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para marcar esta notificación',
      );
    }
 
    if (notification.read) return; // ya estaba leída, no hacer UPDATE innecesario
 
    await this.notificationRepository.update(notificationId, { read: true });
  }
 
  /**
   * Marca TODAS las notificaciones no leídas de un usuario como leídas.
   * Un solo UPDATE en lugar de N updates individuales.
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update(
      { userId, read: false },
      { read: true },
    );
 
    return { updated: result.affected ?? 0 };
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Limpieza automática (TTL de 7 días)
  // ─────────────────────────────────────────────────────────────────────────
 
  /**
   * Se ejecuta todos los días a las 3:00 AM.
   * Elimina notificaciones con más de TTL_DAYS días de antigüedad.
   *
   * Se usa un cron job en lugar de TTL nativo de la BD porque:
   *  - PostgreSQL no tiene TTL por fila nativo (a diferencia de Redis/Mongo).
   *  - Una extensión como pg_partman o un trigger sería más compleja de mantener.
   *  - Este job es simple, portable y controlable desde NestJS.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredNotifications(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.TTL_DAYS);
 
    try {
      const result = await this.notificationRepository.delete({
        createdAt: LessThan(cutoff),
      });
 
      this.logger.log(
        `Limpieza de notificaciones: ${result.affected ?? 0} registros eliminados (anteriores a ${cutoff.toISOString()})`,
      );
    } catch (error) {
      this.logger.error(
        `Error en limpieza de notificaciones: ${error.message}`,
        error.stack,
      );
    }
  }
}