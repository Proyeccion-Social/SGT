import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { User } from '../users/entities/user.entity';
import { EmailConfirmation } from './entities/email-confirmation.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Student } from '../student/entities/student.entity';
import { Tutor } from '../tutor/entities/tutor.entity';
import { Session } from './entities/session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { SessionService } from './services/session.service';
import { AuditService } from './services/audit-log.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { UsersModule } from '../users/users.module';
import { TutorModule } from '../tutor/tutor.module';
import { StudentModule } from '../student/student.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, 
      Session,
      AuditLog,
      PasswordResetToken,
      EmailVerificationToken, EmailConfirmation], 'local'),
      
    NotificationsModule, UsersModule,StudentModule, TutorModule
  ],
  controllers: [AuthController],
  providers: [AuthService,
    SessionService,
    AuditService,
    PasswordResetService,
    EmailVerificationService,],
  exports: [AuthService, TypeOrmModule],
})
export class AuthModule { }