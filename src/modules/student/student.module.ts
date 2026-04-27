import { Module } from '@nestjs/common';
import { StudentService } from './services/student.service';
import { Student } from './entities/student.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentInterestedSubject } from '../subjects/entities/student-subject.entity';
import { SubjectsModule } from '../subjects/subjects.module';
import { StudentsController } from './controllers/student.controller';

// src/student/student.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, StudentInterestedSubject], 'local'),
    SubjectsModule,
  ],
  providers: [StudentService],
  controllers: [StudentsController],
  exports: [StudentService, TypeOrmModule],
})
export class StudentModule {}
