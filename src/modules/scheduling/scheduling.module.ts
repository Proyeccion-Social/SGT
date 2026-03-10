import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './services/session.service';
import { SessionsController } from './controllers/sessions.controller';
import { Session } from './entities/session.entity';
import { ScheduledSession } from './entities/scheduled-session.entity';
import { StudentParticipateSession } from './entities/student-participate-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Session, ScheduledSession, StudentParticipateSession],
      'local'),
  ],
  providers: [SessionService],
  controllers: [SessionsController],
  exports: [TypeOrmModule, SessionService],
})
export class SchedulingModule { }
