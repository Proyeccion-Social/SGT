import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './services/session.service';
import { SessionController } from './controllers/sessions.controller';
import { Session } from './entities/session.entity';
import { ScheduledSession } from './entities/scheduled-session.entity';
import { StudentParticipateSession } from './entities/student-participate-session.entity';
import { SessionModificationRequest } from './entities/session-modification-request.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { UsersModule } from '../users/users.module';
import { TutorModule } from '../tutor/tutor.module';
import { AvailabilityModule } from '../availability/availability.module';
import { AuthModule } from '../auth/auth.module';
import { SessionValidationService } from './services/session-validation.service';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';


@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Session, ScheduledSession, StudentParticipateSession,SessionModificationRequest],
      'local'),
    AuthModule,
    AvailabilityModule,
    TutorModule,
    UsersModule,
    SubjectsModule,
    NotificationsModule,
    
  ],
  providers: [SessionService, SessionValidationService, DashboardService],
  controllers: [SessionController,DashboardController],
  exports: [TypeOrmModule, SessionService, DashboardService],
})
export class SchedulingModule { }
