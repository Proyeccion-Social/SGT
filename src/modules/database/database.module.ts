import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// User entities
import { User } from '../users/entities/user.entity';
import { Student } from '../student/entities/student.entity';
import { Tutor } from '../tutor/entities/tutor.entity';
//import { EmailConfirmation } from '../auth/entities/email-confirmation.entity';

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
import { StudentParticipateSession } from '../scheduling/entities/student-participate-session.entity';

// Evaluation entities
import { Question } from '../session-execution/entities/question.entity';
import { Answer } from '../session-execution/entities/answer.entity';

// AUTH ENTITIES (NUEVAS)
import { Session as AuthSession } from '../auth/entities/session.entity'; // Renombrado para evitar conflicto con la entidad de sesiones de tutoría
import { AuditLog } from '../auth/entities/audit-log.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';
import { SessionModificationRequest } from '../scheduling/entities/session-modification-request.entity';

const entities = [
  User,
  Student,
  Tutor,
  TutorImpartSubject,
  Subject,
  StudentInterestedSubject,
  Availability,
  TutorHaveAvailability,
  Session,
  ScheduledSession,
  SessionModificationRequest,
  StudentParticipateSession,
  Question,
  Answer,


  //Nuevas entidades de Auth
  AuthSession,
  AuditLog,
  PasswordResetToken,
  EmailVerificationToken,
  //EmailConfirmation,
];

@Module({
  imports: [
    // Local PostgreSQL (DEV)
    TypeOrmModule.forRootAsync({
      name: 'local',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('LOCAL_DB_HOST'),
        port: configService.get<number>('LOCAL_DB_PORT'),
        username: configService.get<string>('LOCAL_DB_USER'),
        password: configService.get<string>('LOCAL_DB_PASSWORD') || '',
        database: configService.get<string>('LOCAL_DB_NAME'),
        entities,
        synchronize: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),

    /*
    // Neon PostgreSQL (PROD ONLY)
    ...(process.env.NODE_ENV === 'production'
      ? [
          TypeOrmModule.forRootAsync({
            name: 'neon',
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              type: 'postgres',
              url: configService.get<string>('NEON_DATABASE_URL'),
              entities,
              synchronize: false,
              ssl: { rejectUnauthorized: false },
            }),
          }),
        ]
      : []),
      */
  ],
})
export class DatabaseModule { }
