// src/tutor/tutor.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tutor } from './entities/tutor.entity';
import { User } from '../users/entities/user.entity';
import { TutorImpartSubject } from '../subjects/entities/tutor-subject.entity';
import { Subject } from '../subjects/entities/subjects.entity';
import { TutorService } from './services/tutor.service';
import { TutorsController } from './controllers/tutor.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tutor,
      User,
      TutorImpartSubject,
      Subject,
    ]),
    NotificationsModule, // Para EmailService
  ],
  controllers: [TutorsController],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}