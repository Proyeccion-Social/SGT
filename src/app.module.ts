import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubjectsService } from './subjects/services/subjects.service';
import { SubjectsController } from './subjects/subjects.controller';
import { SubjectsModule } from './subjects/subjects.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationsController } from './notifications/controllers/notifications.controller';
import { SchedulingModule } from './scheduling/scheduling.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { RatingQueryService } from './evaluation/services/rating-query.service';


@Module({
  imports: [AuthModule, UsersModule, SubjectsModule, NotificationsModule, SchedulingModule, EvaluationModule],
  providers: [SubjectsService, RatingQueryService],
  controllers: [SubjectsController, NotificationsController]
})
export class AppModule {}
