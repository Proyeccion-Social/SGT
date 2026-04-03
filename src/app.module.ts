import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { SessionExecutionModule } from './modules/session-execution/session-execution';
import { envValidationSchema } from './config/env.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotificationsModule } from './modules/app-notification/app-notification.module';
import { AppNotificationsService } from './modules/app-notification/services/app-notifications.service';
import { AppNotificationsController } from './modules/app-notification/controllers/app-notifications.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,

    SubjectsModule,
    AvailabilityModule,
    NotificationsModule,
    TutorModule,
    SchedulingModule,
    SessionExecutionModule,
    AppNotificationsModule,


  ],
  providers: [AppNotificationsService],
  controllers: [AppNotificationsController],
})
export class AppModule { }
