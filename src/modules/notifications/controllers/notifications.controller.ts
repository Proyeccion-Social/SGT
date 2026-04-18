// src/notifications/controllers/notifications.controller.ts
//
// Todas las rutas requieren JWT válido con rol ADMIN.
// Cada método delega directamente en un método del NotificationsService
// existente — sin métodos auxiliares inventados.
// El controller no resuelve IDs ni consulta otros módulos: eso es
// responsabilidad del servicio llamante antes de llegar aquí.

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole, User } from '../../users/entities/user.entity';

import { NotificationsService } from '../services/notifications.service';
import {
  SessionScheduledDto,
  SessionReminderDto,
  EvaluationPendingDto,
  AvailabilityChangedDto,
  HoursLimitAlertDto,
} from '../dto/notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // RF-25 | POST /session-scheduled
  //
  // Sesión individual: envía solicitud al tutor + acuse al estudiante.
  // Sesión colaborativa: envía la difusión a estudiantes interesados.
  //
  // El esquema original pedía solo sessionId y un notificationType, pero ese
  // diseño obliga al módulo de notificaciones a consultar otros módulos para
  // resolver los datos del email, creando acoplamiento circular. El DTO ahora
  // lleva los datos completos que el servicio llamante ya tiene disponibles.
  // ───────────────────────────────────────────────────────────────────────────

  @Post('session-scheduled')
  @HttpCode(HttpStatus.OK)
  async sessionScheduled(@Body() dto: SessionScheduledDto) {
    this.logger.log(
      `[RF-25] session-scheduled | sessionId=${dto.sessionId} type=${dto.sessionType}`,
    );

    // Construimos el objeto "session" que el servicio ya espera en su firma.
    // Así no se toca el contrato de NotificationsService y el controller
    // permanece como simple adaptador HTTP.
    const sessionLike = this.buildSessionLike(dto);

    try {
      //if (dto.sessionType === 'INDIVIDUAL') {
      // Dos llamadas paralelas: una al tutor, otra al estudiante
      await Promise.all([
        this.notificationsService.sendTutorConfirmationRequest(
          sessionLike,
          dto.studentId,
        ),
        this.notificationsService.sendStudentSessionRequestAck(
          sessionLike,
          dto.studentId,
        ),
      ]);
      const recipientsCount = 2;
      //}
      /*
      else {
        // COLLABORATIVE: difusión a cada estudiante interesado registrado
        // El servicio de scheduling ya resolvió la lista de emails
        const emails = dto.interestedStudentEmails ?? [];
        await this.notificationsService.sendCollaborativeSessionAnnouncement(
          sessionLike,
          emails,
        );
        recipientsCount = emails.length;
      }*/

      return {
        message: 'Notificación enviada exitosamente',
        sessionId: dto.sessionId,
        sessionType: dto.sessionType,
        recipientsCount,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError(error, 'session-scheduled', dto.sessionId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RF-26 | POST /session-reminder
  //
  // Recordatorios 24h y 2h antes. El cron job garantiza que la sesión esté
  // en estado SCHEDULED y la fecha sea futura antes de llamar este endpoint,
  // por lo que el controller no repite esa validación de negocio.
  // ───────────────────────────────────────────────────────────────────────────

  @Post('session-reminder')
  @HttpCode(HttpStatus.OK)
  async sessionReminder(@Body() dto: SessionReminderDto) {
    this.logger.log(
      `[RF-26] session-reminder | sessionId=${dto.sessionId} type=${dto.reminderType}`,
    );

    const sessionLike = this.buildSessionLikeFromReminder(dto);

    try {
      await this.notificationsService.sendSessionReminder(
        sessionLike,
        dto.reminderType as '24_HOURS_BEFORE' | '2_HOURS_BEFORE',
      );

      // Tutor + todos los participantes
      const recipientsCount = 1 + dto.participantIds.length;

      return {
        message: 'Recordatorio enviado exitosamente',
        sessionId: dto.sessionId,
        reminderType: dto.reminderType,
        recipientsCount,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError(error, 'session-reminder', dto.sessionId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RF-27 | POST /evaluation-pending
  //
  // El campo isReminder (enviado en el body) controla si es la notificación
  // inicial o el recordatorio de 24h. El servicio de ejecución de sesiones
  // y el cron job son responsables de no llamar más de 2 veces por par
  // (sessionId, studentId). El controller no duplica esa lógica.
  // ───────────────────────────────────────────────────────────────────────────

  @Post('evaluation-pending')
  @HttpCode(HttpStatus.OK)
  async evaluationPending(@Body() dto: EvaluationPendingDto) {
    this.logger.log(
      `[RF-27] evaluation-pending | sessionId=${dto.sessionId} studentId=${dto.studentId} isReminder=${dto.isReminder}`,
    );

    // Construimos el shape mínimo que sendEvaluationPendingReminder espera
    const sessionLike = {
      id: dto.sessionId,
      scheduledDate: dto.sessionDate,
      startTime: dto.sessionTime,
      title: dto.sessionTitle,
      tutor: { name: dto.tutorName },
      subject: { name: dto.subjectName },
      participants: [{ id: dto.studentId, name: dto.studentName }],
    };

    try {
      await this.notificationsService.sendEvaluationPendingReminder(
        sessionLike,
        dto.studentId,
        dto.isReminder,
      );

      return {
        message: 'Notificación de evaluación pendiente enviada exitosamente',
        sessionId: dto.sessionId,
        studentId: dto.studentId,
        isReminder: dto.isReminder,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError(error, 'evaluation-pending', dto.sessionId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RF-28 | POST /availability-changed
  //
  // El módulo de disponibilidad ya resolvió nombre, email y datos de cada
  // sesión afectada. El controller solo transforma el DTO al shape que
  // sendAvailabilityChangeNotification espera y delega.
  // ───────────────────────────────────────────────────────────────────────────

  @Post('availability-changed')
  @HttpCode(HttpStatus.OK)
  async availabilityChanged(@Body() dto: AvailabilityChangedDto) {
    this.logger.log(
      `[RF-28] availability-changed | tutorId=${dto.tutorId} sessions=${dto.affectedSessions.length}`,
    );

    // Mapeamos al tipo que ya acepta el servicio existente
    const affectedForService = dto.affectedSessions.map((s) => ({
      sessionId: s.sessionId,
      studentId: s.studentId,
      studentName: s.studentName,
      studentEmail: s.studentEmail,
      subjectName: s.subjectName,
      scheduledDate: new Date(s.scheduledDate),
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.title,
      changeType: s.changeType as 'CANCELLED' | 'MODIFIED' | 'SLOT_DELETED',
    }));

    try {
      await this.notificationsService.sendAvailabilityChangeNotification(
        dto.tutorId,
        dto.tutorName,
        affectedForService,
        dto.changeReason,
      );

      return {
        message:
          'Notificaciones de cambio de disponibilidad enviadas exitosamente',
        tutorId: dto.tutorId,
        notificationsSent: dto.affectedSessions.length,
        affectedSessions: dto.affectedSessions.map((s) => ({
          sessionId: s.sessionId,
          studentId: s.studentId,
          changeType: s.changeType,
          notified: true,
        })),
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError(error, 'availability-changed', dto.tutorId);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RF-29 | POST /hours-limit-alert
  //
  // La validación @Min(80) del DTO ya garantiza que solo se llame al superar
  // el umbral. La consistencia hoursUsed <= weeklyHourLimit se verifica aquí
  // porque es una regla de negocio entre dos campos del mismo DTO.
  // ───────────────────────────────────────────────────────────────────────────

  @Post('hours-limit-alert')
  @HttpCode(HttpStatus.OK)
  async hoursLimitAlert(@Body() dto: HoursLimitAlertDto) {
    this.logger.log(
      `[RF-29] hours-limit-alert | tutorId=${dto.tutorId} usage=${dto.usagePercentage}%`,
    );

    if (dto.hoursUsed > dto.weeklyHourLimit) {
      // Inconsistencia de datos del llamante; retornamos 400 semántico
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message:
          'Datos inconsistentes: hoursUsed no puede superar weeklyHourLimit',
      });
    }

    try {
      await this.notificationsService.sendHourLimitAlert(
        dto.tutorId,
        dto.tutorName,
        dto.tutorEmail,
        dto.weeklyHourLimit,
        dto.hoursUsed,
        dto.usagePercentage,
      );

      const alertLevel =
        dto.usagePercentage >= 100
          ? '100_PERCENT'
          : dto.usagePercentage >= 95
            ? '95_PERCENT'
            : '80_PERCENT';

      return {
        message: 'Alerta de límite de horas enviada exitosamente',
        tutorId: dto.tutorId,
        weeklyHourLimit: dto.weeklyHourLimit,
        hoursUsed: dto.hoursUsed,
        usagePercentage: dto.usagePercentage,
        alertLevel,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleProviderError(error, 'hours-limit-alert', dto.tutorId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Adaptadores privados
  //
  // Construyen el "session-like" object que los métodos del servicio esperan.
  // Centralizado aquí para no repetir la misma transformación en cada handler.
  // ─────────────────────────────────────────────────────────────────────────

  private buildSessionLike(dto: SessionScheduledDto) {
    return {
      id: dto.sessionId,
      scheduledDate: dto.scheduledDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      duration: dto.duration,
      modality: dto.modality,
      title: dto.title,
      description: dto.description ?? null,
      virtualLink: dto.virtualLink ?? null,
      tutor: { id: dto.tutorId, name: dto.tutorName },
      subject: { name: dto.subjectName },
      // participants[0] es el estudiante que agenda en sesiones individuales
      participants: [{ id: dto.studentId, name: dto.studentName }],
    };
  }

  private buildSessionLikeFromReminder(dto: SessionReminderDto) {
    return {
      id: dto.sessionId,
      scheduledDate: dto.scheduledDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      modality: dto.modality,
      title: dto.title,
      description: dto.description ?? null,
      location: dto.location ?? null,
      virtualLink: dto.virtualLink ?? null,
      tutor: { id: dto.tutorId, name: dto.tutorName },
      subject: { name: dto.subjectName },
      participants: dto.participantIds.map((id, i) => ({
        id,
        name: dto.participantNames[i] ?? 'Participante',
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manejador de errores del proveedor de email
  //
  // Solo transforma errores desconocidos en 500 INTERNAL_02 estandarizado.
  // Los errores de dominio (NotFoundException, ConflictException) los lanza
  // directamente el servicio y NestJS los serializa sin intervención aquí.
  // ─────────────────────────────────────────────────────────────────────────

  private handleProviderError(
    error: unknown,
    endpoint: string,
    resourceId: string,
  ): never {
    // Si ya es una HttpException, la re-lanzamos tal cual para conservar
    // su código de estado y estructura original
    if (error instanceof HttpException) {
      this.logger.warn(
        `[${endpoint}] Error de dominio propagado | id=${resourceId} | status=${error.getStatus()} | ${error.message}`,
      );
      throw error;
    }

    // Para errores no-HTTP (errores de red, timeout, etc.),
    // consideramos que es un problema del proveedor externo
    this.logger.error(
      `[${endpoint}] Error del proveedor de email | id=${resourceId} | ${(error as Error).message}`,
      (error as Error).stack,
    );
    throw new InternalServerErrorException({
      errorCode: 'INTERNAL_02',
      message: 'Error al enviar notificación',
      description: 'Falla del proveedor de notificaciones',
    });
  }
}
