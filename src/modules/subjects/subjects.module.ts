import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectsService } from './services/subjects.service';
import { SubjectsController } from './controllers/subjects.controller';
import { Subject } from './entities/subjects.entity';
import { TutorImpartSubject } from './entities/tutor-subject.entity';
import { StudentInterestedSubject } from './entities/student-subject.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Subject, TutorImpartSubject, StudentInterestedSubject],
      'local',
    ),
  ],
  providers: [SubjectsService],
  controllers: [SubjectsController],
  exports: [TypeOrmModule, SubjectsService],
})
export class SubjectsModule {}
