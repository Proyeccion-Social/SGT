import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { StudentsController } from './controllers/students.controller';
import { TutorsController } from './controllers/tutors.controller';
import { StudentsService } from './services/students.service';
import { TutorsService } from './services/tutors.service';
import { UsersService } from './services/users.service';


@Module({
  controllers: [UsersController, StudentsController, TutorsController],
  providers: [StudentsService, TutorsService, UsersService]
})
export class UsersModule {}
