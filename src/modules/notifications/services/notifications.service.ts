// src/notifications/services/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { SessionModificationRequest } from 'src/modules/scheduling/entities/session-modification-request.entity';
import { Session } from 'src/modules/scheduling/entities/session.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY no está definida en las variables de entorno');
      throw new Error('RESEND_API_KEY is required');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@yourdomain.com';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

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

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'email-confirmation.hbs',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const htmlContent = template({ fullName, confirmationUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Confirma tu cuenta en Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar email de confirmación a ${email}`, error);
        throw error;
      }

      this.logger.log(`Email de confirmación enviado correctamente a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de confirmación a ${email}`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const loginUrl = `${this.frontendUrl}/login`;

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'welcome-email.hbs',
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const htmlContent = template({ fullName, loginUrl });

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Bienvenido a Atlas - Sistema de Gestión de Tutorías',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar email de bienvenida a ${email}`, error);
        throw error;
      }

      this.logger.log(`Email de bienvenida enviado correctamente a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de bienvenida a ${email}`, error);
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

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'tutor-credentials.hbs',
    );

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const htmlContent = template({
        name,
        email,
        temporaryPassword,
        loginUrl,
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Bienvenido a Atlas - Credenciales de Tutor',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar credenciales de tutor a ${email}`, error);
        throw error;
      }

      this.logger.log(`Credenciales de tutor enviadas correctamente a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar credenciales de tutor a ${email}`, error);
      throw error;
    }
  }

  async sendProfileCompletedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const dashboardUrl = `${this.frontendUrl}/dashboard`;

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'tutor-profile-completed.hbs',
    );

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const htmlContent = template({ name, dashboardUrl });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Perfil de Tutor Completado - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar notificación de perfil completado a ${email}`, error);
        throw error;
      }

      this.logger.log(`Notificación de perfil completado enviada a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de perfil completado a ${email}`, error);
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

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'password-reset.hbs',
    );

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const htmlContent = template({ name, resetUrl });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Recupera tu contraseña - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar email de recuperación a ${email}`, error);
        throw error;
      }

      this.logger.log(`Email de recuperación enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar email de recuperación a ${email}`, error);
      throw error;
    }
  }

  async sendPasswordChangedNotification(
    email: string,
    name: string,
  ): Promise<void> {
    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'password-changed.hbs',
    );

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      const htmlContent = template({ name });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Tu contraseña ha sido cambiada - Atlas',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`Error al enviar notificación de cambio de contraseña a ${email}`, error);
        throw error;
      }

      this.logger.log(`Notificación de cambio de contraseña enviada a ${email}`);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de cambio de contraseña a ${email}`, error);
      // No lanzar error, es solo notificación
    }
  }

  //Scheduling notifications (propose modification, confirmation, cancellation, etc.)

  // ========================================
  // RF-20: CONFIRMACIÓN DE AGENDAMIENTO
  // ========================================

  /**
   * HU-20.2.1, HU-20.2.2: Enviar confirmación al estudiante
   */
  async sendSessionConfirmationStudent(
    session: any, // SessionDetailedDto
    studentId: string,
  ): Promise<void> {
    try {
      // Buscar email del estudiante
      const student = session.participants.find((p) => p.id === studentId);
      
      if (!student) {
        this.logger.warn(`Student ${studentId} not found in session participants`);
        return;
      }

      // Obtener email del estudiante (necesitarías inyectar UserService)
      // Por ahora asumimos que viene en session.participants
      const studentEmail = student.email || `${studentId}@udistrital.edu.co`;

      // Preparar datos para la plantilla
      const templateData = {
        studentName: student.name,
        tutorName: session.tutor.name,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        status: 'Agendada',
        sessionDetailsUrl: `${this.configService.get('FRONTEND_URL')}/sessions/${session.id}`,
        // Si es virtual, incluir enlace
        ...(session.modality === 'VIRT' && {
          isVirtual: true,
          virtualMessage: 'El tutor te enviará el enlace de conexión por correo.',
        }),
      };

      // Renderizar plantilla
      const htmlContent = this.renderTemplate(
        'session-confirmation-student',
        templateData,
      );

      // Enviar email
      await this.resend.emails.send({
        from: this.fromEmail,
        to: studentEmail,
        subject: `Sesión agendada: ${session.subject.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Session confirmation sent to student ${studentEmail} for session ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending session confirmation to student: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * HU-20.3.1, HU-20.3.2: Enviar confirmación al tutor
   */
  async sendSessionConfirmationTutor(
    session: any, // SessionDetailedDto
    tutorId: string,
  ): Promise<void> {
    try {
      // Email del tutor (viene en session.tutor)
      const tutorEmail = `${tutorId}@udistrital.edu.co`; // O desde UserService

      // Obtener nombre del estudiante
      const studentName = session.participants[0]?.name || 'Estudiante';

      // Preparar datos para la plantilla
      const templateData = {
        tutorName: session.tutor.name,
        studentName: studentName,
        subjectName: session.subject.name,
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        modality: this.translateModality(session.modality),
        title: session.title,
        description: session.description,
        sessionDetailsUrl: `${this.configService.get('FRONTEND_URL')}/tutor/sessions/${session.id}`,
        ...(session.modality === 'VIRT' && {
          isVirtual: true,
          virtualMessage: 'Recuerda enviar el enlace de conexión al estudiante.',
        }),
      };

      // Renderizar plantilla
      const htmlContent = this.renderTemplate(
        'session-confirmation-tutor',
        templateData,
      );

      // Enviar email
      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: `Nueva sesión agendada: ${session.subject.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Session confirmation sent to tutor ${tutorEmail} for session ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending session confirmation to tutor: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ========================================
  // RF-21: CANCELACIÓN DE SESIÓN
  // ========================================

  /**
   * Enviar notificación de cancelación a ambas partes
   */
  async sendSessionCancellation(
    session: Session,
    cancelledBy: string,
  ): Promise<void> {
    try {
      // Determinar quién canceló
      const isTutor = session.idTutor === cancelledBy;
      const cancelledByRole = isTutor ? 'tutor' : 'estudiante';

      // Preparar datos comunes
      const baseData = {
        subjectName: session.subject?.name || 'Materia',
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        cancellationReason: session.cancellationReason || 'No especificada',
        cancelledBy: cancelledByRole,
        cancelledWithin24h: session.cancelledWithin24h,
      };

      // Enviar a tutor
      const tutorEmail = `${session.idTutor}@udistrital.edu.co`;
      const tutorHtml = this.renderTemplate('session-cancelled', {
        ...baseData,
        recipientName: session.tutor?.user?.name || 'Tutor',
        recipientRole: 'tutor',
      });

      await this.resend.emails.send({
        from: this.fromEmail,
        to: tutorEmail,
        subject: `Sesión cancelada: ${session.subject?.name}`,
        html: tutorHtml,
      });

      // Enviar a estudiante(s)
      if (session.studentParticipateSessions?.length > 0) {
        for (const participation of session.studentParticipateSessions) {
          const studentEmail = `${participation.idStudent}@udistrital.edu.co`;
          const studentHtml = this.renderTemplate('session-cancelled', {
            ...baseData,
            recipientName: participation.student?.user?.name || 'Estudiante',
            recipientRole: 'estudiante',
          });

          await this.resend.emails.send({
            from: this.fromEmail,
            to: studentEmail,
            subject: `Sesión cancelada: ${session.subject?.name}`,
            html: studentHtml,
          });
        }
      }

      this.logger.log(`Cancellation emails sent for session ${session.idSession}`);
    } catch (error) {
      this.logger.error(
        `Error sending cancellation emails: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ========================================
  // RF-22: MODIFICACIÓN DE SESIÓN
  // ========================================

  /**
   * Enviar solicitud de modificación a la otra parte
   */
  async sendModificationRequest(
    session: Session,
    requestedBy: string,
    request: SessionModificationRequest,
  ): Promise<void> {
    try {
      const isTutor = session.idTutor === requestedBy;

      // Preparar cambios propuestos
      const changes: string[]= [];
      if (request.newScheduledDate) {
        changes.push(
          `Fecha: ${this.formatDate(session.scheduledDate)} → ${this.formatDate(request.newScheduledDate)}`,
        );
      }
      if (request.newStartTime) {
        changes.push(
          `Hora: ${session.startTime} → ${request.newStartTime}`,
        );
      }
      if (request.newModality) {
        changes.push(
          `Modalidad: ${this.translateModality(session.modality)} → ${this.translateModality(request.newModality)}`,
        );
      }
      if (request.newDurationHours) {
        changes.push(
          `Duración: ${this.calculateDuration(session)} → ${request.newDurationHours}h`,
        );
      }

      const templateData = {
        recipientRole: isTutor ? 'estudiante' : 'tutor',
        requesterRole: isTutor ? 'tutor' : 'estudiante',
        subjectName: session.subject?.name || 'Materia',
        currentDate: this.formatDate(session.scheduledDate),
        currentTime: `${session.startTime} - ${session.endTime}`,
        title: session.title,
        proposedChanges: changes,
        expiresAt: this.formatDateTime(request.expiresAt),
        acceptUrl: `${this.configService.get('FRONTEND_URL')}/sessions/${session.idSession}/modifications/${request.idRequest}/accept`,
        rejectUrl: `${this.configService.get('FRONTEND_URL')}/sessions/${session.idSession}/modifications/${request.idRequest}/reject`,
      };

      // Determinar destinatario
      const recipientEmail = isTutor
        ? `${session.studentParticipateSessions[0]?.idStudent}@udistrital.edu.co`
        : `${session.idTutor}@udistrital.edu.co`;

      const htmlContent = this.renderTemplate(
        'session-modification-request',
        templateData,
      );

      await this.resend.emails.send({
        from: this.fromEmail,
        to: recipientEmail,
        subject: `Solicitud de modificación: ${session.subject?.name}`,
        html: htmlContent,
      });

      this.logger.log(
        `Modification request sent for session ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending modification request: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Enviar respuesta a solicitud de modificación
   */
  async sendModificationResponse(
    session: Session,
    request: SessionModificationRequest,
    accepted: boolean,
  ): Promise<void> {
    try {
      // Enviar al solicitante
      const requesterEmail = `${request.requestedBy}@udistrital.edu.co`;

      const templateData = {
        accepted,
        subjectName: session.subject?.name || 'Materia',
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
        }),
        sessionDetailsUrl: `${this.configService.get('FRONTEND_URL')}/sessions/${session.idSession}`,
      };

      const htmlContent = this.renderTemplate(
        'session-modification-response',
        templateData,
      );

      const subject = accepted
        ? `✅ Modificación aceptada: ${session.subject?.name}`
        : `❌ Modificación rechazada: ${session.subject?.name}`;

      await this.resend.emails.send({
        from: this.fromEmail,
        to: requesterEmail,
        subject,
        html: htmlContent,
      });

      this.logger.log(
        `Modification response sent for session ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending modification response: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Enviar notificación de actualización de detalles
   */
  async sendSessionDetailsUpdate(session: Session): Promise<void> {
    try {
      const templateData = {
        subjectName: session.subject?.name || 'Materia',
        date: this.formatDate(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        newTitle: session.title,
        newDescription: session.description,
        sessionDetailsUrl: `${this.configService.get('FRONTEND_URL')}/sessions/${session.idSession}`,
      };

      const htmlContent = this.renderTemplate(
        'session-details-updated',
        templateData,
      );

      // Enviar a tutor
      await this.resend.emails.send({
        from: this.fromEmail,
        to: `${session.idTutor}@udistrital.edu.co`,
        subject: `Detalles actualizados: ${session.subject?.name}`,
        html: htmlContent,
      });

      // Enviar a estudiantes
      if (session.studentParticipateSessions?.length > 0) {
        for (const participation of session.studentParticipateSessions) {
          await this.resend.emails.send({
            from: this.fromEmail,
            to: `${participation.idStudent}@udistrital.edu.co`,
            subject: `Detalles actualizados: ${session.subject?.name}`,
            html: htmlContent,
          });
        }
      }

      this.logger.log(
        `Details update notification sent for session ${session.idSession}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending details update: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // =====================================================
  // HELPER PRIVADO - Para templates inline (fallback)
  // =====================================================
  private getInlineTemplate(type: string, data: any): string {
    // Fallback si no existe archivo de template
    const templates = {
      tutorCredentials: `
        <h1>¡Bienvenido a Atlas, ${data.name}!</h1>
        <p>Has sido registrado como tutor.</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Contraseña temporal:</strong> ${data.temporaryPassword}</p>
        <p><a href="${data.loginUrl}">Iniciar Sesión</a></p>
        <p><strong>⚠️ Importante:</strong> Debes cambiar tu contraseña en el primer inicio de sesión.</p>
      `,
      profileCompleted: `
        <h1>¡Perfil Completado, ${data.name}!</h1>
        <p>Tu perfil de tutor ha sido completado exitosamente.</p>
        <p>Ahora aparecerás en las búsquedas de estudiantes.</p>
        <p><a href="${data.dashboardUrl}">Ir al Dashboard</a></p>
      `,
      passwordReset: `
        <h1>Recupera tu contraseña, ${data.name}</h1>
        <p>Has solicitado recuperar tu contraseña.</p>
        <p><a href="${data.resetUrl}">Restablecer Contraseña</a></p>
        <p>Este enlace expira en 1 hora.</p>
      `,
      passwordChanged: `
        <h1>Contraseña Cambiada, ${data.name}</h1>
        <p>Tu contraseña ha sido cambiada exitosamente.</p>
        <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
      `,
    };

    return templates[type] || '<p>Email notification</p>';
  }

  private renderTemplate(templateName: string, data: any): string {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'notifications',
        'templates',
        `${templateName}.hbs`,
      );

      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      return template(data);
    } catch (error) {
      this.logger.error(
        `Error rendering template ${templateName}: ${error.message}`,
      );
      // Fallback a texto plano
      return this.generatePlainTextFallback(templateName, data);
    }
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  }

  private formatDateTime(date: Date): string {
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

  private calculateDuration(session: Session): number {
    const [startHour, startMin] = session.startTime.split(':').map(Number);
    const [endHour, endMin] = session.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  }

  private calculateNewEndTime(request: SessionModificationRequest): string {
    if (!request.newStartTime || !request.newDurationHours) {
      return '';
    }
    const [hours, minutes] = request.newStartTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + request.newDurationHours * 60;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  private generatePlainTextFallback(templateName: string, data: any): string {
    return `
      <html>
        <body>
          <h1>Notificación de Sesión</h1>
          <p>Template: ${templateName}</p>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body>
      </html>
    `;
  }
}