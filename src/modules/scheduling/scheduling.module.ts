import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulingService } from './services/scheduling.service';
import { SessionsController } from './controllers/sessions.controller';
import { Session } from './entities/session.entity';
import { ScheduledSession } from './entities/scheduled-session.entity';
import { StudentParticipateSession } from './entities/student_participate_session';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Session, ScheduledSession, StudentParticipateSession],
      'local'),
  ],
  providers: [SchedulingService],
  controllers: [SessionsController],
  exports: [TypeOrmModule, SchedulingService],
})
export class SchedulingModule {}
