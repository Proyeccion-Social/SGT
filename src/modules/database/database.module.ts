import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// User entities
import { User } from '../users/entities/user.entity';
import { Student } from '../student/entities/student.entity';
import { Tutor } from '../tutor/entities/tutor.entity';

// Subject entities
import { Subject } from '../subjects/entities/subjects.entity';
import { TutorImpartSubject } from '../subjects/entities/tutor-subject.entity';
import { StudentInterestedSubject } from '../subjects/entities/student-subject.entity';

// Availability entities
import { Availability } from '../availability/entities/availability.entity';
import { TutorHaveAvailability } from '../availability/entities/tutor-availability.entity';

// Session entities
import { Session } from '../scheduling/entities/session.entity';
import { ScheduledSession } from '../scheduling/entities/scheduled-session.entity';
import { StudentParticipateSession } from '../scheduling/entities/student_participate_session';

// Evaluation entities
import { Question } from '../session-execution/entities/question.entity';
import { Answer } from '../session-execution/entities/answer.entity';

const entities = [
  User,
  Student,
  Tutor,
  Subject,
  TutorImpartSubject,
  StudentInterestedSubject,
  Availability,
  TutorHaveAvailability,
  Session,
  ScheduledSession,
  StudentParticipateSession,
  Question,
  Answer,
];

@Module({
  imports: [
    // Local PostgreSQL
    TypeOrmModule.forRootAsync({
      name: 'local',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('LOCAL_DB_HOST'),
        port: configService.get('LOCAL_DB_PORT'),
        username: configService.get('LOCAL_DB_USER'),
        password: configService.get('LOCAL_DB_PASSWORD'),
        database: configService.get('LOCAL_DB_NAME'),
        entities: entities,
        synchronize: false, 
        logging: configService.get('NODE_ENV') === 'development',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
      }),
    }),

    // Neon PostgreSQL (Producción)
    TypeOrmModule.forRootAsync({
      name: 'neon',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('NEON_DATABASE_URL'),
        entities: entities,
        synchronize: false,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
