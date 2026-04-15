// src/modules/notifications/services/notifications.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

import { Session } from 'src/modules/scheduling/entities/session.entity';
import { SessionModificationRequest } from 'src/modules/scheduling/entities/session-modification-request.entity';
import { UserService } from 'src/modules/users/services/users.service';
import { AppNotificationsService } from '../../app-notification/services/app-notifications.service';
import { AppNotificationType } from '../../app-notification/entities/app-notification.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos de ayuda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Etiquetas para cada operación dentro de un Promise.allSettled,
 * usadas exclusivamente en los logs de error para saber exactamente qué falló.
 */
type OperationLabel = 'email' | 'persistencia';

interface LabeledOperation {
  label: OperationLabel;
  /** Contexto adicional para el log (ej. destinatario, tipo). */
  context: string;
  promise: Promise<any>;
}

interface SessionDetailsChange {
  label: string;
  previous: string | null;
  current: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UserService,
    private readonly appNotifications: AppNotificationsService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.error('RESEND_API_KEY no está definida en las variables de entorno');
      throw new Error('RESEND_API_KEY is required');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@yourdomain.com';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Registrar helpers de Handlebars una sola vez en el constructor
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    this.logger.log('NotificationsService inicializado correctamente');
  }

  // =====================================================
  // ESTUDIANTES - Registro
  // (sin persistencia en BD: emails de onboarding, no acciones de sesión)
  // =====================================================

  async sendEmailConfirmation(email: string, fullName: string, token: string): Promise<void> {
    const confirmationUrl = `${this.frontendUrl}/confirm-email?token=${token}`;
    const htmlContent = this.renderTemplate('email-confirmation', { fullName, confirmationUrl });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Confirma tu cuenta en Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Email de confirmación enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de confirmación a ${email}`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const htmlContent = this.renderTemplate('welcome-email', {
      fullName,
      loginUrl: `${this.frontendUrl}/login`,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Bienvenido a Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Email de bienvenida enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de bienvenida a ${email}`, error);
      throw error;
    }
  }

  // =====================================================
  // TUTORES - Credenciales temporales
  // =====================================================

  async sendTutorCredentials(email: string, name: string, temporaryPassword: string): Promise<void> {
    const htmlContent = this.renderTemplate('tutor-credentials', {
      name, email, temporaryPassword,
      loginUrl: `${this.frontendUrl}/login`,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Bienvenido a Atlas - Credenciales de Tutor',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Credenciales de tutor enviadas a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar credenciales de tutor a ${email}`, error);
      throw error;
    }
  }

  async sendProfileCompletedNotification(email: string, name: string): Promise<void> {
    const htmlContent = this.renderTemplate('tutor-profile-completed', {
      name,
      dashboardUrl: `${this.frontendUrl}/dashboard`,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Perfil de Tutor Completado - Atlas',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Notificación de perfil completado enviada a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de perfil completado a ${email}`, error);
      throw error;
    }
  }

  // =====================================================
  // PASSWORD RESET
  // =====================================================

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<void> {
    const htmlContent = this.renderTemplate('password-reset', {
      name,
      resetUrl: `${this.frontendUrl}/reset-password?token=${resetToken}`,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Recupera tu contraseña - Atlas',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Email de recuperación enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de recuperación a ${email}`, error);
      throw error;
    }
  }

  async sendPasswordChangedNotification(email: string, name: string): Promise<void> {
    const htmlContent = this.renderTemplate('password-changed', { name });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail, to: email,
        subject: 'Tu contraseña ha sido cambiada - Atlas',
        html: htmlContent,
      });
      if (error) throw error;
      this.logger.log(`Notificación de cambio de contraseña enviada a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de cambio de contraseña a ${email}`, error);
      // Intencional: no re-lanzar — es solo notificación de seguridad.
    }
  }

  // =====================================================
  // RF-25 / RF-20: AGENDAMIENTO — Solicitud al tutor
  //
  // Recibe el DTO mapeado (session: any), donde:
  //   session.id        → idSession de la entidad
  //   session.tutor.id  → idUser del tutor (Tutor.idUser)
  // =====================================================

  async sendTutorConfirmationRequest(session: any, studentId: string): Promise<void> {
    try {
      const tutorEmail = await this.getUserEmail(session.tutor.id);
      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const htmlContent = this.renderTemplate('tutor-confirmation-request', {
        tutorName: session.tutor.name,
        studentName,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        confirmUrl: `${this.frontendUrl}/tutor/sessions/${session.id}/confirm`,
        rejectUrl: `${this.frontendUrl}/tutor/sessions/${session.id}/reject`,
        expiresAt: this.formatDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      });

      await this.settleAll([
        {
          label: 'email',
          context: `tutor=${session.tutor.id} sesión=${session.id}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail,
            subject: `Nueva solicitud de tutoría: ${session.subject.name}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${session.tutor.id} type=SESSION_REQUEST_RECEIVED`,
          promise: this.appNotifications.create({
            userId: session.tutor.id,
            type: AppNotificationType.SESSION_REQUEST_RECEIVED,
            message: `${studentName} solicitó una sesión de ${session.subject.name}`,
            payload: { sessionId: session.id },
          }),
        },
      ]);

      this.logger.log(`[RF-25] Solicitud de confirmación enviada al tutor ${tutorEmail} — sesión ${session.id}`);
    } catch (error: any) {
      this.logger.error(`Error en sendTutorConfirmationRequest: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =====================================================
  // RF-25 / RF-20: AGENDAMIENTO — Acuse al estudiante
  // =====================================================

  async sendStudentSessionRequestAck(session: any, studentId: string): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);
      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const htmlContent = this.renderTemplate('session-request-ack-student', {
        studentName,
        tutorName: session.tutor.name,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        status: 'Pendiente de confirmación del tutor',
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.id}`,
      });

      await this.settleAll([
        {
          label: 'email',
          context: `estudiante=${studentId} sesión=${session.id}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: studentEmail,
            subject: `Solicitud enviada: ${session.subject.name} — pendiente de confirmación`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${studentId} type=SESSION_REQUEST_ACK`,
          promise: this.appNotifications.create({
            userId: studentId,
            type: AppNotificationType.SESSION_REQUEST_ACK,
            message: `Tu solicitud de sesión de ${session.subject.name} con ${session.tutor.name} fue enviada`,
            payload: { sessionId: session.id },
          }),
        },
      ]);

      this.logger.log(`[RF-25] Acuse enviado al estudiante ${studentEmail} — sesión ${session.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error en sendStudentSessionRequestAck: ${message}`, stack);
      throw error;
    }
  }

  // =====================================================
  // RF-20: CONFIRMACIÓN — Tutor acepta la sesión
  // =====================================================

  async sendSessionConfirmationStudent(session: any, studentId: string): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);
      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const htmlContent = this.renderTemplate('session-confirmation-student', {
        studentName,
        tutorName: session.tutor.name,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.id}`,
        isVirtual: session.modality === 'VIRT',
        virtualLink: session.virtualLink ?? null,
      });

      await this.settleAll([
        {
          label: 'email',
          context: `estudiante=${studentId} sesión=${session.id}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: studentEmail,
            subject: `¡Sesión confirmada! ${session.subject.name}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${studentId} type=SESSION_CONFIRMED`,
          promise: this.appNotifications.create({
            userId: studentId,
            type: AppNotificationType.SESSION_CONFIRMED,
            message: `${session.tutor.name} confirmó tu sesión de ${session.subject.name} para el ${this.formatDate(session.scheduledDate)}`,
            payload: { sessionId: session.id },
          }),
        },
      ]);

      this.logger.log(`[RF-20] Confirmación enviada al estudiante ${studentEmail} — sesión ${session.id}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error en sendSessionConfirmationStudent: ${err.message}`, err.stack);
      throw error;
    }
  }

  async sendSessionConfirmationTutor(session: any, tutorId: string): Promise<void> {
    try {
      const tutorEmail = await this.getUserEmail(tutorId);
      const studentName = session.participants[0]?.name ?? 'Estudiante';

      const htmlContent = this.renderTemplate('session-confirmation-tutor', {
        tutorName: session.tutor.name,
        studentName,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        sessionDetailsUrl: `${this.frontendUrl}/tutor/sessions/${session.id}`,
        isVirtual: session.modality === 'VIRT',
      });

      await this.settleAll([
        {
          label: 'email',
          context: `tutor=${tutorId} sesión=${session.id}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail,
            subject: `Nueva sesión agendada: ${session.subject.name}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${tutorId} type=SESSION_CONFIRMED`,
          promise: this.appNotifications.create({
            userId: tutorId,
            type: AppNotificationType.SESSION_CONFIRMED,
            message: `Confirmaste la sesión de ${session.subject.name} con ${studentName} para el ${this.formatDate(session.scheduledDate)}`,
            payload: { sessionId: session.id },
          }),
        },
      ]);

      this.logger.log(`[RF-20] Confirmación enviada al tutor ${tutorEmail} — sesión ${session.id}`);
    } catch (error) {
      this.logger.error(`Error en sendSessionConfirmationTutor: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  // =====================================================
  // RF-20: RECHAZO — Tutor rechaza la sesión
  //
  // Recibe la entidad Session. Los campos correctos son:
  //   session.idSession       (PK)
  //   session.idTutor         (FK, igual a tutor.idUser)
  //   session.tutor.user.name (nombre del tutor, via relación)
  //   participation.student.idUser → NO existe; el PK de Student es idUser
  //   pero en StudentParticipateSession la FK es idStudent
  // =====================================================

  async sendSessionRejection(session: Session, studentId: string): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);

      // El nombre del estudiante viene de la relación cargada.
      // Buscamos la participación cuyo idStudent coincide para no asumir [0].
      const participation = session.studentParticipateSessions?.find(
        (p) => p.idStudent === studentId,
      );
      const studentName = participation?.student?.user?.name ?? 'Estudiante';
      const tutorName = session.tutor?.user?.name ?? 'Tutor';
      const subjectName = session.subject?.name ?? 'Materia';

      const htmlContent = this.renderTemplate('session-rejected', {
        studentName, tutorName, subjectName,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        rejectionReason: session.rejectionReason ?? 'No especificada',
        rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
        // idTutor es el idUser del tutor, sirve para construir el perfil
        tutorProfileUrl: `${this.frontendUrl}/tutors/${session.idTutor}`,
      });

      await this.settleAll([
        {
          label: 'email',
          context: `estudiante=${studentId} sesión=${session.idSession}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: studentEmail,
            subject: `Solicitud no aceptada — ${subjectName}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${studentId} type=SESSION_REJECTED`,
          promise: this.appNotifications.create({
            userId: studentId,
            type: AppNotificationType.SESSION_REJECTED,
            message: `${tutorName} no aceptó tu solicitud de sesión de ${subjectName}`,
            // idSession es la PK de la entidad Session
            payload: { sessionId: session.idSession },
          }),
        },
      ]);

      this.logger.log(`[RF-20] Rechazo enviado a ${studentEmail} — sesión ${session.idSession}`);
    } catch (error) {
      this.logger.error(`Error en sendSessionRejection: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // =====================================================
  // RF-21: CANCELACIÓN DE SESIÓN
  // =====================================================

  async sendSessionCancellation(session: Session, cancelledBy: string): Promise<void> {
    try {
      const isCancelledByTutor = session.idTutor === cancelledBy;
      const cancelledByRole = isCancelledByTutor ? 'tutor' : 'estudiante';
      const subjectName = session.subject?.name ?? 'Materia';
      const tutorName = session.tutor?.user?.name ?? 'Tutor';

      const baseData = {
        subjectName,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        cancellationReason: session.cancellationReason ?? 'No especificada',
        cancelledBy: cancelledByRole,
        cancelledWithin24h: session.cancelledWithin24h,
        rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
      };

      const studentIds = (session.studentParticipateSessions ?? []).map((p) => p.idStudent);
      const [tutorEmail, studentEmails] = await Promise.all([
        this.getUserEmail(session.idTutor),
        this.getUserEmails(studentIds),
      ]);

      const operations: LabeledOperation[] = [
        {
          label: 'email',
          context: `tutor=${session.idTutor} sesión=${session.idSession}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail,
            subject: `Sesión cancelada — ${subjectName}`,
            html: this.renderTemplate('session-cancelled', {
              ...baseData,
              recipientName: tutorName,
              recipientRole: 'tutor',
            }),
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${session.idTutor} type=SESSION_CANCELLED`,
          promise: this.appNotifications.create({
            userId: session.idTutor,
            type: AppNotificationType.SESSION_CANCELLED,
            // Si él mismo canceló, decimos "tú", si no, nombramos al estudiante
            message: isCancelledByTutor
              ? `Cancelaste la sesión de ${subjectName}`
              : `La sesión de ${subjectName} fue cancelada por el estudiante`,
            payload: { sessionId: session.idSession },
          }),
        },
      ];

      for (const participation of session.studentParticipateSessions ?? []) {
        const studentEmail = studentEmails.get(participation.idStudent);
        if (!studentEmail) continue;

        const studentName = participation.student?.user?.name ?? 'Estudiante';

        operations.push(
          {
            label: 'email',
            context: `estudiante=${participation.idStudent} sesión=${session.idSession}`,
            promise: this.resend.emails.send({
              from: this.fromEmail, to: studentEmail,
              subject: `Sesión cancelada — ${subjectName}`,
              html: this.renderTemplate('session-cancelled', {
                ...baseData,
                recipientName: studentName,
                recipientRole: 'estudiante',
              }),
            }),
          },
          {
            label: 'persistencia',
            context: `userId=${participation.idStudent} type=SESSION_CANCELLED`,
            promise: this.appNotifications.create({
              userId: participation.idStudent,
              type: AppNotificationType.SESSION_CANCELLED,
              message: isCancelledByTutor
                ? `${tutorName} canceló tu sesión de ${subjectName}`
                : `Cancelaste tu sesión de ${subjectName} con ${tutorName}`,
              payload: { sessionId: session.idSession },
            }),
          },
        );
      }

      await this.settleAll(operations);

      this.logger.log(`[RF-21] Emails de cancelación enviados — sesión ${session.idSession}`);
    } catch (error) {
      this.logger.error(`Error en sendSessionCancellation: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  // =====================================================
  // RF-22: PROPUESTA DE MODIFICACIÓN
  // =====================================================

  async sendModificationRequest(
    session: Session,
    requestedBy: string,
    request: SessionModificationRequest,
  ): Promise<void> {
    try {
      const isTutor = session.idTutor === requestedBy;
      const subjectName = session.subject?.name ?? 'Materia';

      const changes: string[] = [];
      if (request.newScheduledDate) {
        changes.push(`Fecha: ${this.formatDate(session.scheduledDate)} → ${this.formatDate(request.newScheduledDate)}`);
      }
      if (request.newStartTime) {
        changes.push(`Hora de inicio: ${session.startTime} → ${request.newStartTime}`);
      }
      if (request.newModality) {
        changes.push(`Modalidad: ${this.translateModality(session.modality)} → ${this.translateModality(request.newModality)}`);
      }
      if (request.newDurationHours) {
        changes.push(`Duración: ${this.calculateDurationFromEntity(session)}h → ${request.newDurationHours}h`);
      }

      // El destinatario es la contraparte (quien no propuso)
      const recipientId = isTutor
        ? session.studentParticipateSessions?.[0]?.idStudent
        : session.idTutor;

      if (!recipientId) {
        this.logger.warn(
          `No se encontró destinatario para la modificación — sesión ${session.idSession}`,
        );
        return;
      }

      const recipientEmail = await this.getUserEmail(recipientId);

      // Nombre de quien propone, para el mensaje de la notificación
      const requesterName = isTutor
        ? (session.tutor?.user?.name ?? 'El tutor')
        : (session.studentParticipateSessions?.[0]?.student?.user?.name ?? 'El estudiante');

      const htmlContent = this.renderTemplate('session-modification-request', {
        recipientRole: isTutor ? 'estudiante' : 'tutor',
        requesterRole: isTutor ? 'tutor' : 'estudiante',
        subjectName,
        currentDate: this.formatDate(session.scheduledDate),
        currentTime: `${session.startTime} - ${session.endTime}`,
        title: session.title,
        proposedChanges: changes,
        expiresAt: this.formatDateTime(request.expiresAt),
        // idRequest es la PK de SessionModificationRequest
        acceptUrl: `${this.frontendUrl}/sessions/${session.idSession}/modifications/${request.idRequest}/accept`,
        rejectUrl: `${this.frontendUrl}/sessions/${session.idSession}/modifications/${request.idRequest}/reject`,
      });

      await this.settleAll([
        {
          label: 'email',
          context: `destinatario=${recipientId} sesión=${session.idSession}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: recipientEmail,
            subject: `Propuesta de modificación — ${subjectName}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${recipientId} type=MODIFICATION_REQUEST`,
          promise: this.appNotifications.create({
            userId: recipientId,
            type: AppNotificationType.MODIFICATION_REQUEST,
            message: `${requesterName} propuso modificar la sesión de ${subjectName}`,
            // Incluimos requestId para que el frontend construya el link de aceptar/rechazar
            payload: { sessionId: session.idSession, requestId: request.idRequest },
          }),
        },
      ]);

      this.logger.log(`[RF-22] Propuesta de modificación enviada — sesión ${session.idSession}`);
    } catch (error) {
      this.logger.error(`Error en sendModificationRequest: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  // =====================================================
  // RF-22: RESPUESTA A PROPUESTA DE MODIFICACIÓN
  // =====================================================

  async sendModificationResponse(
    session: Session,
    request: SessionModificationRequest,
    accepted: boolean,
  ): Promise<void> {
    try {
      const subjectName = session.subject?.name ?? 'Materia';
      const requesterEmail = await this.getUserEmail(request.requestedBy);

      const htmlContent = this.renderTemplate('session-modification-response', {
        accepted,
        subjectName,
        title: session.title,
        originalDate: this.formatDate(session.scheduledDate),
        originalTime: `${session.startTime} - ${session.endTime}`,
        // Solo incluimos los nuevos valores si fue aceptada
        ...(accepted && {
          newDate: request.newScheduledDate
            ? this.formatDate(request.newScheduledDate)
            : this.formatDate(session.scheduledDate),
          newTime: request.newStartTime
            ? `${request.newStartTime} - ${this.calculateNewEndTime(request)}`
            : `${session.startTime} - ${session.endTime}`,
          newModality: request.newModality
            ? this.translateModality(request.newModality)
            : null,
        }),
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.idSession}`,
      });

      const notifType = accepted
        ? AppNotificationType.MODIFICATION_ACCEPTED
        : AppNotificationType.MODIFICATION_REJECTED;

      await this.settleAll([
        {
          label: 'email',
          context: `solicitante=${request.requestedBy} sesión=${session.idSession}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: requesterEmail,
            subject: accepted
              ? `Modificación aceptada — ${subjectName}`
              : `Modificación rechazada — ${subjectName}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${request.requestedBy} type=${notifType}`,
          promise: this.appNotifications.create({
            userId: request.requestedBy,
            type: notifType,
            message: accepted
              ? `Tu propuesta de modificación para la sesión de ${subjectName} fue aceptada`
              : `Tu propuesta de modificación para la sesión de ${subjectName} fue rechazada`,
            payload: { sessionId: session.idSession, requestId: request.idRequest },
          }),
        },
      ]);

      this.logger.log(`[RF-22] Respuesta de modificación (${accepted ? 'aceptada' : 'rechazada'}) enviada — sesión ${session.idSession}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error en sendModificationResponse: ${err.message}`, err.stack);
      throw error;
    }
  }

  // =====================================================
  // RF-22: ACTUALIZACIÓN DE DETALLES (sin aprobación)
  // =====================================================

  async sendSessionDetailsUpdate(
    session: Session,
    changes: SessionDetailsChange[] = [],
  ): Promise<void> {
    try {
      const subjectName = session.subject?.name ?? 'Materia';
      const htmlContent = this.renderTemplate('session-details-updated', {
        subjectName,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        newTitle: session.title,
        newDescription: session.description,
        newLocation: session.location ?? null,
        newVirtualLink: session.virtualLink ?? null,
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.idSession}`,
        changes,
        hasChanges: changes.length > 0,
      });

      const emailSubject = `Detalles actualizados — ${subjectName}`;
      const notifMessage = `Los detalles de tu sesión de ${subjectName} fueron actualizados`;
      const notifPayload = { sessionId: session.idSession };

      const studentIds = (session.studentParticipateSessions ?? []).map((p) => p.idStudent);
      const [tutorEmail, studentEmails] = await Promise.all([
        this.getUserEmail(session.idTutor),
        this.getUserEmails(studentIds),
      ]);

      const operations: LabeledOperation[] = [
        {
          label: 'email',
          context: `tutor=${session.idTutor} sesión=${session.idSession}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail,
            subject: emailSubject, html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${session.idTutor} type=SESSION_DETAILS_UPDATED`,
          promise: this.appNotifications.create({
            userId: session.idTutor,
            type: AppNotificationType.SESSION_DETAILS_UPDATED,
            message: notifMessage,
            payload: notifPayload,
          }),
        },
      ];

      for (const participation of session.studentParticipateSessions ?? []) {
        const studentEmail = studentEmails.get(participation.idStudent);
        if (!studentEmail) continue;

        operations.push(
          {
            label: 'email',
            context: `estudiante=${participation.idStudent} sesión=${session.idSession}`,
            promise: this.resend.emails.send({
              from: this.fromEmail, to: studentEmail,
              subject: emailSubject, html: htmlContent,
            }),
          },
          {
            label: 'persistencia',
            context: `userId=${participation.idStudent} type=SESSION_DETAILS_UPDATED`,
            promise: this.appNotifications.create({
              userId: participation.idStudent,
              type: AppNotificationType.SESSION_DETAILS_UPDATED,
              message: notifMessage,
              payload: notifPayload,
            }),
          },
        );
      }

      await this.settleAll(operations);

      this.logger.log(`[RF-22] Actualización de detalles notificada — sesión ${session.idSession}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error en sendSessionDetailsUpdate: ${err.message}`, err.stack);
      throw error;
    }
  }

  // =====================================================
  // RF-26: RECORDATORIOS DE SESIÓN
  //
  // Recibe el DTO mapeado (session: any):
  //   session.id       → idSession
  //   session.tutor.id → idUser del tutor
  //   session.participants[i].id → idUser del estudiante
  // =====================================================

  async sendSessionReminder(
    session: any,
    reminderType: '24_HOURS_BEFORE' | '2_HOURS_BEFORE',
  ): Promise<void> {
    try {
      const is24Hours = reminderType === '24_HOURS_BEFORE';
      const notifType = is24Hours
        ? AppNotificationType.SESSION_REMINDER_24H
        : AppNotificationType.SESSION_REMINDER_2H;
      const notifMessage = is24Hours
        ? `Mañana tienes sesión de ${session.subject.name} a las ${session.startTime}`
        : `En 2 horas tienes sesión de ${session.subject.name} a las ${session.startTime}`;

      const baseData = {
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        modality: this.translateModality(session.modality),
        location: session.location ?? null,
        virtualLink: session.virtualLink ?? null,
        title: session.title,
        description: session.description,
        timeUntilSession: is24Hours ? '24 horas' : '2 horas',
        is24Hours,
        is2Hours: !is24Hours,
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.id}`,
        cancelUrl: `${this.frontendUrl}/sessions/${session.id}/cancel`,
      };

      const reminderSubject = is24Hours
        ? `Recordatorio: sesión mañana — ${session.subject.name}`
        : `Recordatorio: sesión en 2 horas — ${session.subject.name}`;

      const participantIds = (session.participants as any[]).map((p) => p.id);
      const [tutorEmail, participantEmails] = await Promise.all([
        this.getUserEmail(session.tutor.id),
        this.getUserEmails(participantIds),
      ]);

      const operations: LabeledOperation[] = [
        {
          label: 'email',
          context: `tutor=${session.tutor.id} tipo=${reminderType}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail, subject: reminderSubject,
            html: this.renderTemplate('session-reminder', {
              ...baseData,
              recipientName: session.tutor.name,
              recipientRole: 'tutor',
              counterpartName: session.participants[0]?.name ?? 'Estudiante',
            }),
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${session.tutor.id} type=${notifType}`,
          promise: this.appNotifications.create({
            userId: session.tutor.id,
            type: notifType,
            message: notifMessage,
            payload: { sessionId: session.id },
          }),
        },
      ];

      for (const participant of session.participants) {
        const studentEmail = participantEmails.get(participant.id);
        if (!studentEmail) continue;

        operations.push(
          {
            label: 'email',
            context: `estudiante=${participant.id} tipo=${reminderType}`,
            promise: this.resend.emails.send({
              from: this.fromEmail, to: studentEmail, subject: reminderSubject,
              html: this.renderTemplate('session-reminder', {
                ...baseData,
                recipientName: participant.name,
                recipientRole: 'estudiante',
                counterpartName: session.tutor.name,
              }),
            }),
          },
          {
            label: 'persistencia',
            context: `userId=${participant.id} type=${notifType}`,
            promise: this.appNotifications.create({
              userId: participant.id,
              type: notifType,
              message: notifMessage,
              payload: { sessionId: session.id },
            }),
          },
        );
      }

      await this.settleAll(operations);

      this.logger.log(`[RF-26] Recordatorio (${reminderType}) enviado — sesión ${session.id}`);
    } catch (error) {
      this.logger.error(`Error en sendSessionReminder: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // =====================================================
  // RF-27: EVALUACIÓN PENDIENTE
  // =====================================================

  async sendEvaluationPendingReminder(
    session: any,
    studentId: string,
    isReminder = false,
  ): Promise<void> {
    try {
      const student = session.participants.find((p: any) => p.id === studentId);
      if (!student) {
        this.logger.warn(
          `Estudiante ${studentId} no encontrado en participantes de la sesión ${session.id}`,
        );
        return;
      }

      const studentEmail = await this.getUserEmail(studentId);
      const notifType = isReminder
        ? AppNotificationType.EVALUATION_REMINDER
        : AppNotificationType.EVALUATION_PENDING;

      await this.settleAll([
        {
          label: 'email',
          context: `estudiante=${studentId} sesión=${session.id} isReminder=${isReminder}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: studentEmail,
            subject: isReminder
              ? `Recordatorio: califica tu sesión de ${session.subject.name}`
              : `Califica tu sesión de tutoría — ${session.subject.name}`,
            html: this.renderTemplate('evaluation-pending', {
              studentName: student.name,
              tutorName: session.tutor.name,
              subjectName: session.subject.name,
              sessionDate: this.formatDate(session.scheduledDate),
              sessionTime: session.startTime,
              title: session.title,
              isReminder,
              evaluationUrl: `${this.frontendUrl}/sessions/${session.id}/evaluate`,
            }),
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${studentId} type=${notifType}`,
          promise: this.appNotifications.create({
            userId: studentId,
            type: notifType,
            message: isReminder
              ? `Aún no has calificado tu sesión de ${session.subject.name} con ${session.tutor.name}`
              : `Califica tu sesión de ${session.subject.name} con ${session.tutor.name}`,
            payload: { sessionId: session.id },
          }),
        },
      ]);

      this.logger.log(`[RF-27] ${isReminder ? 'Recordatorio' : 'Notificación'} de evaluación enviado a ${studentEmail} — sesión ${session.id}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error en sendEvaluationPendingReminder: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
 * Notifica a un estudiante que el tutor registró su inasistencia a la sesión.
 *
 * @param sessionId   ID de la sesión (Session.idSession)
 * @param studentId   ID del estudiante ausente (StudentParticipateSession.idStudent)
 * @param studentName Nombre del estudiante (participation.student.user.name)
 * @param tutorName   Nombre del tutor (session.tutor?.user?.name, o cargado aparte)
 * @param subjectName Nombre de la materia (session.subject?.name)
 * @param sessionDate Fecha de la sesión (session.scheduledDate)
 * @param startTime   Hora de inicio (session.startTime)
 */
  async sendSessionAbsentNotification(
    sessionId: string,
    studentId: string,
    studentName: string,
    tutorName: string,
    subjectName: string,
    sessionDate: string,
    startTime: string,
  ): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);

      const htmlContent = this.renderTemplate('session-absent', {
        studentName,
        tutorName,
        subjectName,
        date: this.formatDate(sessionDate),
        startTime,
        // Link para que el estudiante contacte al tutor o reagende
        rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
      });

      await this.settleAll([
        {
          label: 'email',
          context: `estudiante=${studentId} sesión=${sessionId}`,
          promise: this.resend.emails.send({
            from: this.fromEmail,
            to: studentEmail,
            subject: `Inasistencia registrada — ${subjectName}`,
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${studentId} type=SESSION_ABSENT`,
          promise: this.appNotifications.create({
            userId: studentId,
            type: AppNotificationType.SESSION_ABSENT,
            message: `Tu inasistencia a la sesión de ${subjectName} con ${tutorName} fue registrada`,
            payload: { sessionId },
          }),
        },
      ]);

      this.logger.log(
        `[Attendance] Notificación de inasistencia enviada a ${studentEmail} — sesión ${sessionId}`,
      );
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Error en sendSessionAbsentNotification: ${normalizedError.message}`,
        normalizedError.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-28: CAMBIO DE DISPONIBILIDAD DEL TUTOR
  //
  // Este método recibe studentEmail ya resuelto por el DTO del controller,
  // por lo que no necesita consultar UserService.
  // =====================================================

  async sendAvailabilityChangeNotification(
    tutorId: string,
    tutorName: string,
    affectedSessions: Array<{
      sessionId: string;
      studentId: string;
      studentName: string;
      studentEmail: string;
      subjectName: string;
      scheduledDate: Date;
      startTime: string;
      endTime: string;
      title: string;
      changeType: 'CANCELLED' | 'MODIFIED' | 'SLOT_DELETED';
    }>,
    changeReason?: string,
  ): Promise<void> {
    try {
      const subjectMap: Record<string, string> = {
        CANCELLED: 'Sesión cancelada',
        MODIFIED: 'Sesión modificada',
        SLOT_DELETED: 'Cambio en disponibilidad',
      };

      const notifMessageMap = (affected: typeof affectedSessions[0]): string => ({
        CANCELLED: `Tu sesión de ${affected.subjectName} con ${tutorName} fue cancelada por cambio de disponibilidad`,
        MODIFIED: `Tu sesión de ${affected.subjectName} con ${tutorName} fue modificada por cambio de disponibilidad`,
        SLOT_DELETED: `La disponibilidad de ${tutorName} para tu sesión de ${affected.subjectName} fue eliminada`,
      }[affected.changeType]);

      const operations: LabeledOperation[] = [];

      for (const affected of affectedSessions) {
        const htmlContent = this.renderTemplate('availability-changed', {
          studentName: affected.studentName,
          tutorName,
          subjectName: affected.subjectName,
          originalDate: this.formatDate(affected.scheduledDate),
          originalTime: `${affected.startTime} - ${affected.endTime}`,
          title: affected.title,
          changeType: affected.changeType,
          isCancelled: affected.changeType === 'CANCELLED',
          isModified: affected.changeType === 'MODIFIED',
          isSlotDeleted: affected.changeType === 'SLOT_DELETED',
          changeReason: changeReason ?? 'No especificada',
          rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
          tutorProfileUrl: `${this.frontendUrl}/tutors/${tutorId}`,
        });

        operations.push(
          {
            label: 'email',
            context: `estudiante=${affected.studentId} sesión=${affected.sessionId} changeType=${affected.changeType}`,
            promise: this.resend.emails.send({
              from: this.fromEmail, to: affected.studentEmail,
              subject: `${subjectMap[affected.changeType]} — ${affected.subjectName}`,
              html: htmlContent,
            }),
          },
          {
            label: 'persistencia',
            context: `userId=${affected.studentId} type=AVAILABILITY_CHANGED`,
            promise: this.appNotifications.create({
              userId: affected.studentId,
              type: AppNotificationType.AVAILABILITY_CHANGED,
              message: notifMessageMap(affected),
              payload: { sessionId: affected.sessionId },
            }),
          },
        );
      }

      await this.settleAll(operations);

      this.logger.log(`[RF-28] Notificaciones de cambio de disponibilidad enviadas — ${affectedSessions.length} sesiones afectadas`);
    } catch (error) {
      this.logger.error(`Error en sendAvailabilityChangeNotification: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // =====================================================
  // RF-29: ALERTA DE LÍMITE DE HORAS
  //
  // tutorEmail viene resuelto desde el DTO — no necesita UserService.
  // =====================================================

  async sendHourLimitAlert(
    tutorId: string,
    tutorName: string,
    tutorEmail: string,
    weeklyHourLimit: number,
    hoursUsed: number,
    usagePercentage: number,
  ): Promise<void> {
    try {
      const hoursRemaining = weeklyHourLimit - hoursUsed;

      let alertLevel: '80_PERCENT' | '95_PERCENT' | '100_PERCENT';
      let urgencyLevel: 'warning' | 'urgent' | 'critical';

      if (usagePercentage >= 100) { alertLevel = '100_PERCENT'; urgencyLevel = 'critical'; }
      else if (usagePercentage >= 95) { alertLevel = '95_PERCENT'; urgencyLevel = 'urgent'; }
      else { alertLevel = '80_PERCENT'; urgencyLevel = 'warning'; }

      const htmlContent = this.renderTemplate('hour-limit-alert', {
        tutorName,
        weeklyHourLimit,
        hoursUsed: hoursUsed.toFixed(1),
        hoursRemaining: hoursRemaining.toFixed(1),
        usagePercentage: usagePercentage.toFixed(0),
        alertLevel, urgencyLevel,
        is80Percent: alertLevel === '80_PERCENT',
        is95Percent: alertLevel === '95_PERCENT',
        is100Percent: alertLevel === '100_PERCENT',
        canAcceptMore: usagePercentage < 100,
        sessionsUrl: `${this.frontendUrl}/tutor/sessions`,
        settingsUrl: `${this.frontendUrl}/tutor/settings`,
      });

      const subjectMap: Record<string, string> = {
        '100_PERCENT': 'Límite semanal alcanzado — no puedes aceptar más sesiones',
        '95_PERCENT': 'Casi alcanzas tu límite semanal de horas',
        '80_PERCENT': 'Aviso: estás cerca de tu límite semanal',
      };

      const notifMessageMap: Record<string, string> = {
        '100_PERCENT': `Alcanzaste tu límite semanal de ${weeklyHourLimit}h — no puedes aceptar más sesiones esta semana`,
        '95_PERCENT': `Usaste el 95% de tu límite semanal (${hoursUsed.toFixed(1)}/${weeklyHourLimit}h)`,
        '80_PERCENT': `Usaste el 80% de tu límite semanal (${hoursUsed.toFixed(1)}/${weeklyHourLimit}h)`,
      };

      await this.settleAll([
        {
          label: 'email',
          context: `tutor=${tutorId} alertLevel=${alertLevel}`,
          promise: this.resend.emails.send({
            from: this.fromEmail, to: tutorEmail,
            subject: subjectMap[alertLevel],
            html: htmlContent,
          }),
        },
        {
          label: 'persistencia',
          context: `userId=${tutorId} type=HOUR_LIMIT_ALERT alertLevel=${alertLevel}`,
          promise: this.appNotifications.create({
            userId: tutorId,
            type: AppNotificationType.HOUR_LIMIT_ALERT,
            message: notifMessageMap[alertLevel],
            payload: { alertLevel },
          }),
        },
      ]);

      this.logger.log(`[RF-29] Alerta de límite de horas (${alertLevel}) enviada al tutor ${tutorEmail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error en sendHourLimitAlert: ${message}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // =====================================================
  // RF-25: SESIÓN COLABORATIVA — Difusión a interesados
  // (sin persistencia individual: no tenemos userId, solo email)
  // =====================================================

  async sendCollaborativeSessionAnnouncement(
    session: any,
    interestedStudentEmails: string[],
  ): Promise<void> {
    if (!interestedStudentEmails.length) {
      this.logger.warn(`No hay estudiantes interesados para la sesión colaborativa ${session.id}`);
      return;
    }

    const htmlContent = this.renderTemplate('collaborative-session-available', {
      tutorName: session.tutor.name,
      subjectName: session.subject.name,
      date: this.formatDate(session.scheduledDate),
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      modality: this.translateModality(session.modality),
      title: session.title,
      description: session.description,
      joinUrl: `${this.frontendUrl}/sessions/${session.id}/join`,
    });

    // Difusión: un fallo individual no aborta al resto
    for (const email of interestedStudentEmails) {
      try {
        await this.resend.emails.send({
          from: this.fromEmail, to: email,
          subject: `Nueva sesión colaborativa disponible: ${session.subject.name}`,
          html: htmlContent,
        });
      } catch (err) {
        this.logger.error(`Error enviando anuncio colaborativo a ${email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(
      `[RF-25] Anuncio colaborativo ${session.id} enviado a ${interestedStudentEmails.length} estudiantes`,
    );
  }

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================

  /**
   * Ejecuta un conjunto de operaciones etiquetadas con Promise.allSettled
   * e inspecciona cada resultado para loggear con contexto exacto qué falló.
   *
   * Diseño intencional:
   *   - Email y persistencia son INDEPENDIENTES: si uno falla, el otro no se cancela.
   *   - Un fallo de persistencia NUNCA relanza el error (es secundario al email).
   *   - Un fallo de email SÍ relanza el error (es la operación principal).
   *
   * Así el llamante puede hacer try/catch sobre el método público sabiendo que
   * si llega al catch, fue el email lo que falló, no la BD.
   */
  private async settleAll(operations: LabeledOperation[]): Promise<void> {
    const results = await Promise.allSettled(operations.map((op) => op.promise));

    let emailFailed = false;
    let emailFailedReason: any;

    results.forEach((result, index) => {
      const op = operations[index];

      if (result.status === 'rejected') {
        this.logger.error(
          `Fallo en operación [${op.label}] | contexto: ${op.context} | razón: ${result.reason?.message ?? result.reason}`,
          result.reason?.stack,
        );

        if (op.label === 'email') {
          emailFailed = true;
          emailFailedReason = result.reason;
        }
        // Si es 'persistencia', solo loggeamos — no propagamos.
      }
    });

    // Solo relanzamos si fue el email el que falló
    if (emailFailed) {
      throw emailFailedReason;
    }
  }

  private async getUserEmail(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${userId} no encontrado — no se puede determinar el email`,
      );
    }
    return user.email;
  }

  private async getUserEmails(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();

    const users = await this.usersService.findByIds(userIds);
    const emailMap = new Map<string, string>();

    for (const user of users) {
      emailMap.set(user.idUser, user.email);
    }

    for (const id of userIds) {
      if (!emailMap.has(id)) {
        this.logger.warn(`Usuario con ID ${id} no encontrado al resolver emails en batch`);
      }
    }

    return emailMap;
  }

  private renderTemplate(templateName: string, data: any): string {
    try {
      const templatePath = path.join(
        process.cwd(), 'src', 'modules', 'notifications', 'templates', `${templateName}.hbs`,
      );
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      return Handlebars.compile(templateContent)(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error al renderizar template "${templateName}": ${message}`);
      return this.generatePlainTextFallback(templateName, data);
    }
  }

  //Refactor: Se cambia el método formatDate para que siempre trate la fecha como UTC, evitando problemas de zona horaria al formatear
  private formatDate(date: Date | string): string {
  const dateStr =
    typeof date === 'string'
      ? date
      : date.toISOString().split('T')[0];

  const [year, month, day] = dateStr.split('-').map(Number);

  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // CLAVE
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

  private formatDateTime(date: Date | string): string {
  let dateObj: Date;

  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  const isoStr = dateObj.toISOString();
  const [datePart, timePart] = isoStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

  private translateModality(modality: string): string {
    return modality === 'PRES' ? 'Presencial' : 'Virtual';
  }

  private calculateDurationFromEntity(session: Session): number {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return (toMin(session.endTime) - toMin(session.startTime)) / 60;
  }

  private calculateNewEndTime(request: SessionModificationRequest): string {
    if (!request.newStartTime || !request.newDurationHours) return '';
    const [h, m] = request.newStartTime.split(':').map(Number);
    const total = h * 60 + m + request.newDurationHours * 60;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  private generatePlainTextFallback(templateName: string, data: any): string {
    return `<html><body style="font-family:sans-serif;padding:24px;"><h2>Notificación de Atlas</h2><p><em>No se pudo cargar la plantilla <strong>${templateName}</strong>.</em></p><pre style="background:#f5f5f5;padding:12px;border-radius:4px;">${JSON.stringify(data, null, 2)}</pre></body></html>`;
  }
}