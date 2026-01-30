import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';

@Module({
  providers: [NotificationsService]
})
export class NotificationsModule {}
