import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { EvaluationModule } from './modules/session-execution/session-execution';
import { envValidationSchema } from './config/env.config';

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
    SchedulingModule,
    EvaluationModule,
  ],
})
export class AppModule {}
