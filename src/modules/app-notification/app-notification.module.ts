// src/modules/app-notifications/app-notifications.module.ts
 
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppNotification } from './entities/app-notification.entity';
import { AppNotificationsService } from './services/app-notifications.service';
import { AppNotificationsController } from './controllers/app-notifications.controller';
 
@Module({
  imports: [
    TypeOrmModule.forFeature([AppNotification], 'local'),
    
    ScheduleModule.forRoot(),
  ],
  controllers: [AppNotificationsController],
  providers:   [AppNotificationsService],
  // Exportamos el servicio para que NotificationsModule pueda inyectarlo
  exports:     [TypeOrmModule, AppNotificationsService],
})
export class AppNotificationsModule {}
 