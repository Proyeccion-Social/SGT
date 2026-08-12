/**
 * Script de uso único: agenda una sesión para Sebastián Torres
 * Tutor: Carlos Ramírez | Materia: Cálculo Diferencial
 * Fecha: 2026-05-18 (lunes) | 08:00–09:00 | Presencial
 *
 * Uso: ts-node src/seeders/schedule-session.ts
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  User,
  UserRole,
  UserStatus,
} from '../modules/users/entities/user.entity';
import {
  Student,
  PreferredModality,
} from '../modules/student/entities/student.entity';
import { Tutor } from '../modules/tutor/entities/tutor.entity';
import { Subject } from '../modules/subjects/entities/subjects.entity';
import { TutorImpartSubject } from '../modules/subjects/entities/tutor-subject.entity';
import { StudentInterestedSubject } from '../modules/subjects/entities/student-subject.entity';
import { Availability } from '../modules/availability/entities/availability.entity';
import { TutorHaveAvailability } from '../modules/availability/entities/tutor-availability.entity';
import { Modality } from '../modules/availability/enums/modality.enum';
import { Session as SchedulingSession } from '../modules/scheduling/entities/session.entity';
import { ScheduledSession } from '../modules/scheduling/entities/scheduled-session.entity';
import { SessionModificationRequest } from '../modules/scheduling/entities/session-modification-request.entity';
import { StudentParticipateSession } from '../modules/scheduling/entities/student-participate-session.entity';
import {
  Question,
  QuestionAspect,
} from '../modules/session-execution/entities/question.entity';
import { Answer } from '../modules/session-execution/entities/answer.entity';
import { SessionType } from '../modules/scheduling/enums/session-type.enum';
import { SessionStatus } from '../modules/scheduling/enums/session-status.enum';
import { ParticipationStatus } from '../modules/scheduling/enums/participation-status.enum';
import { AppNotification } from '../modules/app-notification/entities/app-notification.entity';
import { Session as AuthSession } from '../modules/auth/entities/session.entity';
import { AuditLog } from '../modules/auth/entities/audit-log.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../modules/auth/entities/email-verification-token.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.LOCAL_DB_HOST ?? 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT ?? '5432'),
  username: process.env.LOCAL_DB_USER ?? 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? '1234',
  database: process.env.LOCAL_DB_NAME ?? 'atlas-pruebas',
  synchronize: false,
  logging: false,
  entities: [
    User,
    Student,
    Tutor,
    Subject,
    TutorImpartSubject,
    StudentInterestedSubject,
    Availability,
    TutorHaveAvailability,
    SchedulingSession,
    ScheduledSession,
    SessionModificationRequest,
    StudentParticipateSession,
    Question,
    Answer,
    AppNotification,
    AuthSession,
    AuditLog,
    PasswordResetToken,
    EmailVerificationToken,
  ],
});

async function run(): Promise<void> {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const studentRepo = dataSource.getRepository(Student);
  const tutorRepo = dataSource.getRepository(Tutor);
  const subjectRepo = dataSource.getRepository(Subject);
  const sessionRepo = dataSource.getRepository(SchedulingSession);
  const spsRepo = dataSource.getRepository(StudentParticipateSession);

  try {
    const sebastianUser = await userRepo.findOneOrFail({
      where: { email: 'sebastian.torres@udistrital.edu.co' },
    });
    const sebastian = await studentRepo.findOneOrFail({
      where: { idUser: sebastianUser.idUser },
    });
    const carlosUser = await userRepo.findOneOrFail({
      where: { email: 'carlos.ramirez@udistrital.edu.co' },
    });
    const carlos = await tutorRepo.findOneOrFail({
      where: { idUser: carlosUser.idUser },
    });
    const subject = await subjectRepo.findOneOrFail({
      where: { name: 'Cálculo Diferencial' },
    });

    const TODAY = '2026-05-16';
    const START_TIME = '18:09:00';
    const END_TIME = '19:09:00';

    const session = await sessionRepo.save(
      sessionRepo.create({
        idTutor: carlos.idUser,
        idSubject: subject.idSubject,
        scheduledDate: TODAY,
        startTime: START_TIME,
        endTime: END_TIME,
        title: 'Sesión de Cálculo Diferencial',
        description:
          'Revisión de límites, reglas de derivación y aplicaciones básicas.',
        type: SessionType.INDIVIDUAL,
        modality: Modality.PRES,
        location: 'Sala 301 — Edificio de Ingenierías',
        status: SessionStatus.SCHEDULED,
        tutorConfirmed: true,
        tutorConfirmedAt: new Date(),
        cancelledWithin24h: false,
      }),
    );
    console.log('✅ Sesión creada:', session.idSession);

    await spsRepo.save(
      spsRepo.create({
        idStudent: sebastian.idUser,
        idSession: session.idSession,
        status: ParticipationStatus.CONFIRMED,
      }),
    );
    console.log('✅ Participación CONFIRMED registrada');

    console.log('\n──────────────────────────────────────────────────────────');
    console.log(`  ID sesión : ${session.idSession}`);
    console.log(`  Tutor     : Carlos Ramírez (${carlosUser.email})`);
    console.log(`  Estudiante: Sebastián Torres (${sebastianUser.email})`);
    console.log(`  Materia   : Cálculo Diferencial`);
    console.log(`  Fecha     : ${TODAY} | 18:09–19:09 | SCHEDULED`);
    console.log('──────────────────────────────────────────────────────────');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
