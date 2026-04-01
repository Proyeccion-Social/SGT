import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SessionExecutionController } from './controllers/session-execution.controller';
import { AttendanceService } from './services/attendance.service';
import { EvaluationService } from './services/evaluation.service';
import { QuestionCatalogBootstrapService } from './services/question-catalog-bootstrap.service';
import { Question } from './entities/question.entity';
import { Answer } from './entities/answer.entity';
import { Session } from '../scheduling/entities/session.entity';
import { StudentParticipateSession } from '../scheduling/entities/student-participate-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Question, Answer, Session, StudentParticipateSession],
      'local',
    ),
    AuthModule,
  ],
  controllers: [SessionExecutionController],
  providers: [
    AttendanceService,
    EvaluationService,
    QuestionCatalogBootstrapService,
  ],
  exports: [TypeOrmModule, EvaluationService],
})
export class SessionExecutionModule {}

