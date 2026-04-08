import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './controllers/notifications.controller';
import { AppNotificationsModule } from '../app-notification/app-notification.module';


@Module({
  imports: [ConfigModule, UsersModule,AppNotificationsModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule { }
