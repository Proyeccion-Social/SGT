import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionExecutionController } from './controllers/session-execution.controller';
import { AttendanceService } from './services/attendance.service';
import { EvaluationService } from './services/evaluation.service';
import { RatingQueryService } from './services/rating-query.service';
import { Question } from './entities/question.entity';
import { Answer } from './entities/answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Answer], 'local'),
  ],
  controllers: [SessionExecutionController],
  providers: [AttendanceService, EvaluationService, RatingQueryService],
  exports: [TypeOrmModule, EvaluationService],
})
export class SessionExecutionModule {}

