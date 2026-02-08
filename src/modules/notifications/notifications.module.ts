import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';

@Module({
  providers: [NotificationsService, EmailService],
  exports: [EmailService],
})
export class NotificationsModule { }
