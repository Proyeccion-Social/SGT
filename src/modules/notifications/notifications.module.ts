import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './controllers/notifications.controller';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
