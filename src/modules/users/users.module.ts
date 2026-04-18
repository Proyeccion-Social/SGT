import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { StudentsController } from '../student/controllers/student.controller';
import { TutorsController } from '../tutor/controllers/tutor.controller';
import { StudentService } from '../student/services/student.service';
import { TutorService } from '../tutor/services/tutor.service';
import { UserService } from './services/users.service';
import { User } from './entities/user.entity';
import { Student } from '../student/entities/student.entity';
import { Tutor } from '../tutor/entities/tutor.entity';
import { TutorModule } from '../tutor/tutor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User], 'local'),
  ],
  controllers: [UsersController],
  providers: [UserService],
  exports: [TypeOrmModule, UserService],
})
export class UsersModule {}
