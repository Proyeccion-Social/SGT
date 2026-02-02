import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { StudentsController } from '../student/controllers/student.controller';
import { TutorsController } from '../tutor/controllers/tutor.controller';
import { StudentsService } from '../student/services/student.service';
import { TutorsService } from '../tutor/services/tutor.service';
import { UsersService } from './services/users.service';
import { User } from './entities/user.entity';
import { Student } from '../student/entities/student.entity';
import { Tutor } from '../tutor/entities/tutor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Student, Tutor], 'local'),
  ],
  controllers: [UsersController, StudentsController, TutorsController],
  providers: [StudentsService, TutorsService, UsersService],
  exports: [TypeOrmModule, UsersService, StudentsService, TutorsService],
})
export class UsersModule {}
