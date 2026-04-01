// src/notifications/services/notifications.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Session } from 'src/modules/scheduling/entities/session.entity';
import { SessionModificationRequest } from 'src/modules/scheduling/entities/session-modification-request.entity';
import { UserService } from 'src/modules/users/services/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UserService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.error(
        'RESEND_API_KEY no está definida en las variables de entorno',
      );
      throw new Error('RESEND_API_KEY is required');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'noreply@yourdomain.com';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    this.logger.log('Resend inicializado correctamente');
  }

  // =====================================================
  // ESTUDIANTES - Registro
  // =====================================================

  async sendEmailConfirmation(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const confirmationUrl = `${this.frontendUrl}/confirm-email?token=${token}`;
    const htmlContent = this.renderTemplate('email-confirmation', {
      fullName,
      confirmationUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Confirma tu cuenta en Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar email de confirmación a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(`Email de confirmación enviado correctamente a ${email}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar email de confirmación a ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const loginUrl = `${this.frontendUrl}/login`;
    const htmlContent = this.renderTemplate('welcome-email', {
      fullName,
      loginUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Bienvenido a Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar email de bienvenida a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(`Email de bienvenida enviado correctamente a ${email}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar email de bienvenida a ${email}`,
        error,
      );
      throw error;
    }
  }

  // =====================================================
  // TUTORES - Credenciales temporales
  // =====================================================

  async sendTutorCredentials(
    email: string,
    name: string,
    temporaryPassword: string,
  ): Promise<void> {
    const loginUrl = `${this.frontendUrl}/login`;
    const htmlContent = this.renderTemplate('tutor-credentials', {
      name,
      email,
      temporaryPassword,
      loginUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Bienvenido a Atlas - Credenciales de Tutor',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar credenciales de tutor a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(
        `Credenciales de tutor enviadas correctamente a ${email}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar credenciales de tutor a ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendProfileCompletedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const dashboardUrl = `${this.frontendUrl}/dashboard`;
    const htmlContent = this.renderTemplate('tutor-profile-completed', {
      name,
      dashboardUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Perfil de Tutor Completado - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar notificación de perfil completado a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(`Notificación de perfil completado enviada a ${email}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de perfil completado a ${email}`,
        error,
      );
      throw error;
    }
  }

  // =====================================================
  // PASSWORD RESET
  // =====================================================

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    const htmlContent = this.renderTemplate('password-reset', {
      name,
      resetUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Recupera tu contraseña - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar email de recuperación a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(`Email de recuperación enviado a ${email}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar email de recuperación a ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const htmlContent = this.renderTemplate('password-changed', { name });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Tu contraseña ha sido cambiada - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(
          `Error al enviar notificación de cambio de contraseña a ${email}`,
          error,
        );
        throw error;
      }

      this.logger.log(
        `Notificación de cambio de contraseña enviada a ${email}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de cambio de contraseña a ${email}`,
        error,
      );
      // No lanzar error: es solo notificación de seguridad
    }
  }

  // =====================================================
  // RF-25 / RF-20: AGENDAMIENTO — Solicitud al tutor
  // =====================================================

  async sendTutorConfirmationRequest(
    session: any,
    studentId: string,
  ): Promise<void> {
    try {
      const tutorEmail = await this.getUserEmail(session.tutor.id);

      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const templateData = {
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
        expiresAt: this.formatDateTime(
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        ),
      };

      const htmlContent = this.renderTemplate(
        'tutor-confirmation-request',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: `Nueva solicitud de tutoría: ${session.subject.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Solicitud de confirmación enviada al tutor ${tutorEmail} para sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar solicitud de confirmación al tutor: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-25 / RF-20: AGENDAMIENTO — Acuse al estudiante
  // =====================================================

  async sendStudentSessionRequestAck(
    session: any,
    studentId: string,
  ): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);

      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const templateData = {
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
      };

      const htmlContent = this.renderTemplate(
        'session-request-ack-student',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: studentEmail,
        subject: `Solicitud enviada: ${session.subject.name} — pendiente de confirmación`,
        html: htmlContent,
      });

      this.logger.log(
        `Acuse de solicitud enviado al estudiante ${studentEmail} para sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar acuse al estudiante: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-20: CONFIRMACIÓN — Tutor acepta la sesión
  // =====================================================

  async sendSessionConfirmationStudent(
    session: any,
    studentId: string,
  ): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);

      const student = session.participants.find((p: any) => p.id === studentId);
      const studentName = student?.name ?? 'Estudiante';

      const templateData = {
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
      };

      const htmlContent = this.renderTemplate(
        'session-confirmation-student',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: studentEmail,
        subject: `¡Sesión confirmada! ${session.subject.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Confirmación de sesión enviada al estudiante ${studentEmail} — sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar confirmación al estudiante: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendSessionConfirmationTutor(
    session: any,
    tutorId: string,
  ): Promise<void> {
    try {
      const tutorEmail = await this.getUserEmail(tutorId);
      const studentName = session.participants[0]?.name ?? 'Estudiante';

      const templateData = {
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
      };

      const htmlContent = this.renderTemplate(
        'session-confirmation-tutor',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: `Nueva sesión agendada: ${session.subject.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Confirmación de sesión enviada al tutor ${tutorEmail} — sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar confirmación al tutor: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-20: RECHAZO — Tutor rechaza la sesión
  // =====================================================

  async sendSessionRejection(
    session: Session,
    studentId: string,
  ): Promise<void> {
    try {
      const studentEmail = await this.getUserEmail(studentId);
      const studentName =
        session.studentParticipateSessions?.[0]?.student?.user?.name ??
        'Estudiante';

      const templateData = {
        studentName,
        tutorName: session.tutor?.user?.name ?? 'Tutor',
        subjectName: session.subject?.name ?? 'Materia',
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        rejectionReason: session.rejectionReason ?? 'No especificada',
        rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
        tutorProfileUrl: `${this.frontendUrl}/tutors/${session.idTutor}`,
      };

      const htmlContent = this.renderTemplate('session-rejected', templateData);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: studentEmail,
        subject: `Solicitud no aceptada — ${session.subject?.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Notificación de rechazo enviada a ${studentEmail} — sesión ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de rechazo: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-21: CANCELACIÓN DE SESIÓN
  // =====================================================

  async sendSessionCancellation(
    session: Session,
    cancelledBy: string,
  ): Promise<void> {
    try {
      const isCancelledByTutor = session.idTutor === cancelledBy;
      const cancelledByRole = isCancelledByTutor ? 'tutor' : 'estudiante';

      const baseData = {
        subjectName: session.subject?.name ?? 'Materia',
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        cancellationReason: session.cancellationReason ?? 'No especificada',
        cancelledBy: cancelledByRole,
        cancelledWithin24h: session.cancelledWithin24h,
        rescheduleUrl: `${this.frontendUrl}/sessions/schedule`,
      };

      // Notificar al tutor
      const tutorEmail = await this.getUserEmail(session.idTutor);
      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: `Sesión cancelada — ${session.subject?.name}`,
        html: this.renderTemplate('session-cancelled', {
          ...baseData,
          recipientName: session.tutor?.user?.name ?? 'Tutor',
          recipientRole: 'tutor',
        }),
      });

      // Notificar a cada estudiante participante
      if (session.studentParticipateSessions?.length > 0) {
        // Resolvemos todos los emails en paralelo antes de enviar
        const studentEmails = await this.getUserEmails(
          session.studentParticipateSessions.map((p) => p.idStudent),
        );

        for (const participation of session.studentParticipateSessions) {
          const studentEmail = studentEmails.get(participation.idStudent);
          if (!studentEmail) continue;

          await this.resend.emails.send({
            from: this.fromEmail,
            to: studentEmail,
            subject: `Sesión cancelada — ${session.subject?.name}`,
            html: this.renderTemplate('session-cancelled', {
              ...baseData,
              recipientName: participation.student?.user?.name ?? 'Estudiante',
              recipientRole: 'estudiante',
            }),
          });
        }
      }

      this.logger.log(
        `Emails de cancelación enviados para la sesión ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar emails de cancelación: ${error.message}`,
        error.stack,
      );
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

      const changes: string[] = [];
      if (request.newScheduledDate) {
        changes.push(
          `Fecha: ${this.formatDate(session.scheduledDate)} → ${this.formatDate(request.newScheduledDate)}`,
        );
      }
      if (request.newStartTime) {
        changes.push(
          `Hora de inicio: ${session.startTime} → ${request.newStartTime}`,
        );
      }
      if (request.newModality) {
        changes.push(
          `Modalidad: ${this.translateModality(session.modality)} → ${this.translateModality(request.newModality)}`,
        );
      }
      if (request.newDurationHours) {
        changes.push(
          `Duración: ${this.calculateDurationFromEntity(session)}h → ${request.newDurationHours}h`,
        );
      }

      const templateData = {
        recipientRole: isTutor ? 'estudiante' : 'tutor',
        requesterRole: isTutor ? 'tutor' : 'estudiante',
        subjectName: session.subject?.name ?? 'Materia',
        currentDate: this.formatDate(session.scheduledDate),
        currentTime: `${session.startTime} - ${session.endTime}`,
        title: session.title,
        proposedChanges: changes,
        expiresAt: this.formatDateTime(request.expiresAt),
        acceptUrl: `${this.frontendUrl}/sessions/${session.idSession}/modifications/${request.idRequest}/accept`,
        rejectUrl: `${this.frontendUrl}/sessions/${session.idSession}/modifications/${request.idRequest}/reject`,
      };

      const recipientId = isTutor
        ? session.studentParticipateSessions?.[0]?.idStudent
        : session.idTutor;

      if (!recipientId) {
        this.logger.warn(
          `No se encontró destinatario para la modificación de sesión ${session.idSession}`,
        );
        return;
      }

      const recipientEmail = await this.getUserEmail(recipientId);
      const htmlContent = this.renderTemplate(
        'session-modification-request',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: recipientEmail,
        subject: `Propuesta de modificación — ${session.subject?.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Propuesta de modificación enviada para sesión ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar propuesta de modificación: ${error.message}`,
        error.stack,
      );
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
      const requesterEmail = await this.getUserEmail(request.requestedBy);

      const templateData = {
        accepted,
        subjectName: session.subject?.name ?? 'Materia',
        title: session.title,
        originalDate: this.formatDate(session.scheduledDate),
        originalTime: `${session.startTime} - ${session.endTime}`,
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
      };

      const htmlContent = this.renderTemplate(
        'session-modification-response',
        templateData,
      );

      const subject = accepted
        ? `Modificación aceptada — ${session.subject?.name}`
        : `Modificación rechazada — ${session.subject?.name}`;

      await this.resend.emails.send({
        from: this.fromEmail,
        to: requesterEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(
        `Respuesta de modificación (${accepted ? 'aceptada' : 'rechazada'}) enviada para sesión ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar respuesta de modificación: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-22: ACTUALIZACIÓN DE DETALLES
  // =====================================================

  async sendSessionDetailsUpdate(session: Session): Promise<void> {
    try {
      const templateData = {
        subjectName: session.subject?.name ?? 'Materia',
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        newTitle: session.title,
        newDescription: session.description,
        newLocation: session.location ?? null,
        newVirtualLink: session.virtualLink ?? null,
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.idSession}`,
      };

      const htmlContent = this.renderTemplate(
        'session-details-updated',
        templateData,
      );
      const subject = `Detalles actualizados — ${session.subject?.name}`;

      // Resolvemos todos los emails implicados en una sola ronda de consultas
      const studentIds = (session.studentParticipateSessions ?? []).map(
        (p) => p.idStudent,
      );
      const [tutorEmail, studentEmails] = await Promise.all([
        this.getUserEmail(session.idTutor),
        this.getUserEmails(studentIds),
      ]);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject,
        html: htmlContent,
      });

      for (const participation of session.studentParticipateSessions ?? []) {
        const studentEmail = studentEmails.get(participation.idStudent);
        if (!studentEmail) continue;

        await this.resend.emails.send({
          from: this.fromEmail,
          to: studentEmail,
          subject,
          html: htmlContent,
        });
      }

      this.logger.log(
        `Notificación de actualización de detalles enviada para sesión ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de actualización de detalles: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-26: RECORDATORIOS DE SESIÓN
  // =====================================================

  async sendSessionReminder(
    session: any,
    reminderType: '24_HOURS_BEFORE' | '2_HOURS_BEFORE',
  ): Promise<void> {
    try {
      const is24Hours = reminderType === '24_HOURS_BEFORE';
      const timeUntilSession = is24Hours ? '24 horas' : '2 horas';

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
        timeUntilSession,
        is24Hours,
        is2Hours: !is24Hours,
        sessionDetailsUrl: `${this.frontendUrl}/sessions/${session.id}`,
        cancelUrl: `${this.frontendUrl}/sessions/${session.id}/cancel`,
      };

      const reminderSubject = is24Hours
        ? `Recordatorio: sesión mañana — ${session.subject.name}`
        : `Recordatorio: sesión en 2 horas — ${session.subject.name}`;

      // Resolvemos todos los emails en paralelo
      const participantIds = (session.participants as any[]).map((p) => p.id);
      const [tutorEmail, participantEmails] = await Promise.all([
        this.getUserEmail(session.tutor.id),
        this.getUserEmails(participantIds),
      ]);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: reminderSubject,
        html: this.renderTemplate('session-reminder', {
          ...baseData,
          recipientName: session.tutor.name,
          recipientRole: 'tutor',
          counterpartName: session.participants[0]?.name ?? 'Estudiante',
        }),
      });

      for (const participant of session.participants) {
        const studentEmail = participantEmails.get(participant.id);
        if (!studentEmail) continue;

        await this.resend.emails.send({
          from: this.fromEmail,
          to: studentEmail,
          subject: reminderSubject,
          html: this.renderTemplate('session-reminder', {
            ...baseData,
            recipientName: participant.name,
            recipientRole: 'estudiante',
            counterpartName: session.tutor.name,
          }),
        });
      }

      this.logger.log(
        `Recordatorio (${reminderType}) enviado para sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar recordatorio de sesión: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-27: EVALUACIÓN PENDIENTE
  // =====================================================

  async sendEvaluationPendingReminder(
    session: any,
    studentId: string,
    isReminder: boolean = false,
  ): Promise<void> {
    try {
      const student = session.participants.find((p: any) => p.id === studentId);

      if (!student) {
        this.logger.warn(
          `Estudiante ${studentId} no encontrado en los participantes de la sesión ${session.id}`,
        );
        return;
      }

      const studentEmail = await this.getUserEmail(studentId);

      const templateData = {
        studentName: student.name,
        tutorName: session.tutor.name,
        subjectName: session.subject.name,
        sessionDate: this.formatDate(session.scheduledDate),
        sessionTime: session.startTime,
        title: session.title,
        isReminder,
        evaluationUrl: `${this.frontendUrl}/sessions/${session.id}/evaluate`,
      };

      const htmlContent = this.renderTemplate(
        'evaluation-pending',
        templateData,
      );

      const subject = isReminder
        ? `Recordatorio: califica tu sesión de ${session.subject.name}`
        : `Califica tu sesión de tutoría — ${session.subject.name}`;

      await this.resend.emails.send({
        from: this.fromEmail,
        to: studentEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(
        `${isReminder ? 'Recordatorio' : 'Notificación'} de evaluación enviado a ${studentEmail} — sesión ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de evaluación pendiente: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-28: CAMBIO DE DISPONIBILIDAD DEL TUTOR
  // =====================================================

  async sendAvailabilityChangeNotification(
    tutorId: string,
    tutorName: string,
    affectedSessions: Array<{
      sessionId: string;
      studentId: string;
      studentName: string;
      studentEmail: string; // ya resuelto por el llamante vía DTO
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
      for (const affected of affectedSessions) {
        const templateData = {
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
        };

        const htmlContent = this.renderTemplate(
          'availability-changed',
          templateData,
        );

        const subjectMap: Record<string, string> = {
          CANCELLED: `Sesión cancelada — ${affected.subjectName}`,
          MODIFIED: `Sesión modificada — ${affected.subjectName}`,
          SLOT_DELETED: `Cambio en disponibilidad — ${affected.subjectName}`,
        };

        await this.resend.emails.send({
          from: this.fromEmail,
          to: affected.studentEmail,
          subject: subjectMap[affected.changeType],
          html: htmlContent,
        });

        this.logger.log(
          `Notificación de cambio de disponibilidad enviada a ${affected.studentEmail} — sesión ${affected.sessionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al enviar notificaciones de cambio de disponibilidad: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-29: ALERTA DE LÍMITE DE HORAS
  // =====================================================

  async sendHourLimitAlert(
    tutorId: string,
    tutorName: string,
    tutorEmail: string, // ya resuelto por el llamante vía DTO
    weeklyHourLimit: number,
    hoursUsed: number,
    usagePercentage: number,
  ): Promise<void> {
    try {
      const hoursRemaining = weeklyHourLimit - hoursUsed;

      let alertLevel: '80_PERCENT' | '95_PERCENT' | '100_PERCENT';
      let urgencyLevel: 'warning' | 'urgent' | 'critical';

      if (usagePercentage >= 100) {
        alertLevel = '100_PERCENT';
        urgencyLevel = 'critical';
      } else if (usagePercentage >= 95) {
        alertLevel = '95_PERCENT';
        urgencyLevel = 'urgent';
      } else {
        alertLevel = '80_PERCENT';
        urgencyLevel = 'warning';
      }

      const templateData = {
        tutorName,
        weeklyHourLimit,
        hoursUsed: hoursUsed.toFixed(1),
        hoursRemaining: hoursRemaining.toFixed(1),
        usagePercentage: usagePercentage.toFixed(0),
        alertLevel,
        urgencyLevel,
        is80Percent: alertLevel === '80_PERCENT',
        is95Percent: alertLevel === '95_PERCENT',
        is100Percent: alertLevel === '100_PERCENT',
        canAcceptMore: usagePercentage < 100,
        sessionsUrl: `${this.frontendUrl}/tutor/sessions`,
        settingsUrl: `${this.frontendUrl}/tutor/settings`,
      };

      const htmlContent = this.renderTemplate('hour-limit-alert', templateData);

      const subjectMap: Record<string, string> = {
        '100_PERCENT':
          'Límite semanal alcanzado — no puedes aceptar más sesiones',
        '95_PERCENT': 'Casi alcanzas tu límite semanal de horas',
        '80_PERCENT': 'Aviso: estás cerca de tu límite semanal',
      };

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: subjectMap[alertLevel],
        html: htmlContent,
      });

      this.logger.log(
        `Alerta de límite de horas (${alertLevel}) enviada al tutor ${tutorEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar alerta de límite de horas: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // RF-25: SESIÓN COLABORATIVA — Difusión a interesados
  // =====================================================

  async sendCollaborativeSessionAnnouncement(
    session: any,
    interestedStudentEmails: string[],
  ): Promise<void> {
    if (!interestedStudentEmails.length) {
      this.logger.warn(
        `No hay estudiantes interesados para la sesión colaborativa ${session.id}`,
      );
      return;
    }

    const templateData = {
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
    };

    const htmlContent = this.renderTemplate(
      'collaborative-session-available',
      templateData,
    );

    for (const email of interestedStudentEmails) {
      try {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject: `Nueva sesión colaborativa disponible: ${session.subject.name}`,
          html: htmlContent,
        });
      } catch (err) {
        // Un fallo individual no aborta el resto de la difusión
        this.logger.error(
          `Error enviando anuncio colaborativo a ${email}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Anuncio de sesión colaborativa ${session.id} enviado a ${interestedStudentEmails.length} estudiantes`,
    );
  }

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================

  /**
   * Obtiene el email de un usuario desde la BD consultando UsersService.
   * Lanza NotFoundException si el usuario no existe, para que el error
   * suba con contexto claro en lugar de intentar enviar a un email undefined.
   */
  private async getUserEmail(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${userId} no encontrado — no se puede determinar el email`,
      );
    }

    return user.email;
  }

  /**
   * Obtiene los emails de múltiples usuarios en una sola ronda de consultas.
   * Devuelve un Map<userId, email> para acceso O(1) en los loops.
   * Los IDs sin usuario correspondiente se omiten (warn en log).
   */
  private async getUserEmails(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();

    const users = await this.usersService.findByIds(userIds);
    const emailMap = new Map<string, string>();

    for (const user of users) {
      emailMap.set(user.idUser, user.email);
    }

    // Alertar sobre IDs que no se encontraron en BD
    for (const id of userIds) {
      if (!emailMap.has(id)) {
        this.logger.warn(
          `Usuario con ID ${id} no encontrado al resolver emails en batch`,
        );
      }
    }

    return emailMap;
  }

  private renderTemplate(templateName: string, data: any): string {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'modules',
        'notifications',
        'templates',
        `${templateName}.hbs`,
      );

      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      //Cambio propuesto por copilot para evitar error de Handlebars: "Missing helper: 'eq'". Originalmente:       const template        = Handlebars.compile(templateContent);
      // Registrar helpers necesarios para las plantillas.
      // `eq` se usa en las vistas como subexpresión: (eq a b)
      Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
      const template = Handlebars.compile(templateContent);

      return template(data);
    } catch (error) {
      this.logger.error(
        `Error al renderizar template "${templateName}": ${error.message}`,
      );
      return this.generatePlainTextFallback(templateName, data);
    }
  }

  private formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  private formatDateTime(date: Date | string): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  private translateModality(modality: string): string {
    return modality === 'PRES' ? 'Presencial' : 'Virtual';
  }

  private calculateDurationFromEntity(session: Session): number {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMinutes(session.endTime) - toMinutes(session.startTime)) / 60;
  }

  private calculateNewEndTime(request: SessionModificationRequest): string {
    if (!request.newStartTime || !request.newDurationHours) return '';

    const [h, m] = request.newStartTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + request.newDurationHours * 60;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  private generatePlainTextFallback(templateName: string, data: any): string {
    return `
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Notificación de Atlas</h2>
          <p><em>No se pudo cargar la plantilla <strong>${templateName}</strong>.</em></p>
          <pre style="background:#f5f5f5; padding:12px; border-radius:4px;">${JSON.stringify(data, null, 2)}</pre>
        </body>
      </html>
    `;
  }
}
