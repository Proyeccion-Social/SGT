import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubjectsService } from './modules/subjects/services/subjects.service';
import { SubjectsController } from './modules/subjects/controllers/subjects.controller';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationsController } from './modules/notifications/controllers/notifications.controller';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { EvaluationModule } from './modules/session-execution/session-execution';
import { RatingQueryService } from './modules/session-execution/services/rating-query.service';


@Module({
  imports: [AuthModule, UsersModule, SubjectsModule, NotificationsModule, SchedulingModule, EvaluationModule],
  providers: [SubjectsService, RatingQueryService],
  controllers: [SubjectsController, NotificationsController]
})
export class AppModule {}
