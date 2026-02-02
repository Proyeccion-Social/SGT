import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationController } from './controllers/evaluation.controller';
import { TutorRatingsController } from './controllers/tutor-ratings.controller';
import { EvaluationService } from './services/evaluation.service';
import { RatingQueryService } from './services/rating-query.service';
import { Question } from './entities/question.entity';
import { Answer } from './entities/answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Answer], 'local'),
  ],
  controllers: [
    EvaluationController,
    TutorRatingsController,
  ],
  providers: [EvaluationService, RatingQueryService],
  exports: [TypeOrmModule, EvaluationService],
})
export class EvaluationModule {}

