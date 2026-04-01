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


  ],
})
export class AppModule { }
