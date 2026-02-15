// src/notifications/services/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

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
}