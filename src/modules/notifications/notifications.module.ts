import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }
