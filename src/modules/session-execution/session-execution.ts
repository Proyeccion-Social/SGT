import { Module } from '@nestjs/common';
import { EvaluationController } from './controllers/evaluation.controller';
import { TutorRatingsController } from './controllers/tutor-ratings.controller';
import { EvaluationService } from './services/evaluation.service';

@Module({
  controllers: [EvaluationController, TutorRatingsController],
  providers: [EvaluationService]
})
export class EvaluationModule {}
