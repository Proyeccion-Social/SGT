/*import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../modules/users/entities/user.entity';
import { Student } from '../modules/student/entities/student.entity';
import { Tutor } from '../modules/tutor/entities/tutor.entity';
import { Subject } from '../modules/subjects/entities/subjects.entity';
import { TutorImpartSubject } from '../modules/subjects/entities/tutor-subject.entity';
import { StudentInterestedSubject } from '../modules/subjects/entities/student-subject.entity';
import { Availability } from '../modules/availability/entities/availability.entity';
import { TutorHaveAvailability } from '../modules/availability/entities/tutor-availability.entity';
import { Session } from '../modules/scheduling/entities/session.entity';
import { ScheduledSession } from '../modules/scheduling/entities/scheduled-session.entity';
import { SessionModificationRequest } from '../modules/scheduling/entities/session-modification-request.entity';
import { StudentParticipateSession } from '../modules/scheduling/entities/student-participate-session.entity';
import { Question } from '../modules/session-execution/entities/question.entity';
import { Answer } from '../modules/session-execution/entities/answer.entity';
import { AppNotification } from '../modules/app-notification/entities/app-notification.entity';
import { Session as AuthSession } from '../modules/auth/entities/session.entity';
import { AuditLog } from '../modules/auth/entities/audit-log.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../modules/auth/entities/email-verification-token.entity';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.LOCAL_DB_HOST,
    port: parseInt(process.env.LOCAL_DB_PORT!),
    username: process.env.LOCAL_DB_USER,
    password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME,

    synchronize: false,
    logging: process.env.NODE_ENV === 'development',

    //entities: ['src/**/ //entities/*.entity.{ts,js}'],*/
//migrations: ['src/migrations/*.ts'],
//});
