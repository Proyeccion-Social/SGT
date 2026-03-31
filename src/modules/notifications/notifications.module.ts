import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { UserService } from '../users/services/users.service';
import { UsersModule } from '../users/users.module';
//import { EmailService } from './services/email.service';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }
