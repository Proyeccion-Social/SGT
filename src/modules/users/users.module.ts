import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { StudentsController } from '../student/controllers/student.controller';
import { TutorsController } from '../tutor/controllers/tutor.controller';
import { StudentsService } from '../student/services/student.service';
import { TutorsService } from '../tutor/services/tutor.service';
import { UsersService } from './services/users.service';


@Module({
  controllers: [UsersController, StudentsController, TutorsController],
  providers: [StudentsService, TutorsService, UsersService]
})
export class UsersModule {}
