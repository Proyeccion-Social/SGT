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
        const apiKey = "re_RXiJ6BVw_sMnEWZPTdJwuqqKvBV2NUSjE";

        if (!apiKey) {
            this.logger.error('RESEND_API_KEY no está definida en las variables de entorno');
            throw new Error('RESEND_API_KEY is required');
        }

        this.resend = new Resend(apiKey);
        this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') ?? "";
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? "";

        this.logger.log('Resend inicializado correctamente');
    }

    //Envio de email de confirmación de cuenta
    async sendEmailConfirmation(email: string, fullName: string, token: string): Promise<void> {
        const confirmationUrl = `${this.frontendUrl}/confirm-email?token=${token}`;

        const templatePath = path.join(__dirname, '..', 'templates', 'email-confirmation.hbs');
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

    //Envio de email de bienvenida
    async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
        const loginUrl = `${this.frontendUrl}/login`;

        const templatePath = path.join(__dirname, '..', 'templates', 'welcome-email.hbs');
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
}
