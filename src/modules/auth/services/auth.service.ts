// src/auth/services/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '../../users/entities/user.entity';
import { UserService } from '../../users/services/users.service';
import { StudentService } from '../../student/services/student.service';
import { TutorService } from '../../tutor/services/tutor.service';
import { SessionService } from './session.service';
import { AuditService } from './audit-log.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuditAction, AuditResult } from '../entities/audit-log.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService, // Service, no repository
    private readonly studentService: StudentService,
    private readonly tutorService: TutorService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly emailService: NotificationsService,
  ) { }

  // =====================================================
  // REGISTRO DE ESTUDIANTE
  // =====================================================
  
  async register(dto: RegisterDto): Promise<{ message: string }> {
    // 1. Validar que las contraseñas coincidan
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // 2. Validar email institucional
    if (!dto.email.endsWith('@udistrital.edu.co')) {
      throw new BadRequestException(
        'Email must be institutional (@udistrital.edu.co)',
      );
    }

    // 3. Crear usuario usando UserService
    const savedUser = await this.userService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING,
    });

    // 4. Crear registro en tabla students
    await this.studentService.createFromUser(savedUser.idUser);

    // 5. Generar token de verificación de email
    const verificationToken =
      await this.emailVerificationService.createToken(savedUser.idUser);
      console.log('Verification token generated:', verificationToken); // Log del token generado para pruebas (quitar después)

    // 6. Enviar email de confirmación
    try {
      await this.emailService.sendEmailConfirmation(
        savedUser.email,
        savedUser.name,
        verificationToken,
      );
    } catch (error) {
      this.logger.error('Error sending confirmation email:', error);
      // No fallar registro si email falla
    }

    // 7. Auditar
    await this.auditService.log({
      id_user: savedUser.idUser,
      action: AuditAction.ACCOUNT_CREATED,
      result: AuditResult.SUCCESS,
      email_attempted: savedUser.email,
    });

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }
    

  // =====================================================
  // CONFIRMAR EMAIL
  // =====================================================
  async confirmEmail(token: string): Promise<{ message: string }> {
    // 1. Validar token
    const verificationToken =
      await this.emailVerificationService.validateToken(token);

    // 2. Marcar token como usado
    await this.emailVerificationService.markAsVerified(
      verificationToken.id_token,
    );

    // 3. Actualizar usuario usando UserService
    await this.userService.markEmailAsVerified(verificationToken.id_user);

    // 4. Auditar
    await this.auditService.logEmailVerified(verificationToken.id_user);

    // 5. Enviar email de bienvenida
    try {
      const user = await this.userService.findById(verificationToken.id_user);

      if (user) {
        await this.emailService.sendWelcomeEmail(user.email, user.name);
      }
    } catch (error) {
      this.logger.error('Error sending welcome email:', error);
    }

    return { message: 'Email verified successfully. You can now login.' };
  }

  // =====================================================
  // VERIFICAR SI EXISTE EMAIL (ENDPOINT PÚBLICO)
  // =====================================================
  async checkEmailExists(email: string): Promise<boolean> {
    return this.userService.existsByEmail(email);
  }

  // =====================================================
  // LOGIN
  // =====================================================
  async login(
    dto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      emailVerified: boolean;
    };
    requiresPasswordChange?: boolean;
    requiresProfileCompletion?: boolean;
  }> {
    // 1. Buscar usuario
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      await this.auditService.logFailedLogin(
        dto.email,
        'Email not found',
        ip,
        userAgent,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Verificar bloqueo por intentos fallidos
    if (user.locked_until && user.locked_until > new Date()) {
      await this.auditService.logFailedLogin(
        dto.email,
        `Account locked until ${user.locked_until.toISOString()}`,
        ip,
        userAgent,
        user.idUser,
      );
      throw new UnauthorizedException(
        `Account locked until ${user.locked_until.toLocaleString()}`,
      );
    }

    // 3. Desbloqueo automático si pasó el tiempo
    if (user.locked_until && user.locked_until <= new Date()) {
      await this.userService.unlockAccount(user.idUser);
      user.locked_until = null;
      user.failed_login_attempts = 0;
    }

    // 4. Validar contraseña
    const isPasswordValid = await this.userService.validatePassword(
      user,
      dto.password,
    );

    if (!isPasswordValid) {
      // Incrementar contador de intentos fallidos
      const newAttempts = await this.userService.incrementFailedLoginAttempts(
        user.idUser,
      );

      if (newAttempts >= 5) {
        // Bloquear cuenta por 15 minutos
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

        await this.userService.lockAccount(user.idUser, lockedUntil);

        await this.auditService.logFailedLogin(
          dto.email,
          'Invalid password - Account locked',
          ip,
          userAgent,
          user.idUser,
        );

        await this.auditService.logAccountLocked(user.idUser, lockedUntil);

        throw new UnauthorizedException(
          'Too many failed attempts. Account locked for 15 minutes.',
        );
      } else {
        await this.auditService.logFailedLogin(
          dto.email,
          'Invalid password',
          ip,
          userAgent,
          user.idUser,
        );

        throw new UnauthorizedException(
          `Invalid credentials. ${5 - newAttempts} attempts remaining.`,
        );
      }
    }

    // 5. Validar estado de la cuenta
    if (user.status === UserStatus.PENDING) {
      await this.auditService.logFailedLogin(
        dto.email,
        'Email not verified',
        ip,
        userAgent,
        user.idUser,
      );
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.auditService.logFailedLogin(
        dto.email,
        `Account status: ${user.status}`,
        ip,
        userAgent,
        user.idUser,
      );
      throw new UnauthorizedException('Account is not active');
    }

    // 6. Login exitoso - resetear contador de intentos fallidos
    if (user.failed_login_attempts > 0) {
      await this.userService.resetFailedLoginAttempts(user.idUser);
    }

    // 7. Generar tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 8. Crear sesión
    const session = await this.sessionService.createSession({
      user,
      refresh_token: refreshToken,
      //ip_address: ip,
      user_agent: userAgent,
    });

    // 9. Auditar login exitoso
    await this.auditService.logSuccessfulLogin(
      user,
      session.id_session,
      ip,
      userAgent,
    );

    // Fragmento comentado pues dependía de servicio de tutor-profile, que aún no se ha implementado por completo  

    // 10. Verificar si es tutor y necesita acciones adicionales
    let requiresPasswordChange = false;
    let requiresProfileCompletion = false;

    if (user.role === UserRole.TUTOR) {
      // Verificar contraseña temporal
      requiresPasswordChange = !user.password_changed_at;

      // Verificar perfil completo
      requiresProfileCompletion = !(await this.tutorService.isProfileComplete(
        user.idUser,
      ));
    }

    

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.idUser,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: !!user.email_verified_at,
      },
      ...(user.role === UserRole.TUTOR && {
        requiresPasswordChange,
        requiresProfileCompletion,
      }),
    };
  }

  // =====================================================
  // REFRESH TOKEN
  // =====================================================
  async refresh(
    refreshToken: string,
    ip: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Validar refresh token (JWT)
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Verificar que sea refresh token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // 3. Buscar sesión en BD
    const session = await this.sessionService.findValidSession(refreshToken);

    if (!session) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    // 4. Verificar que usuario sigue activo
    const user = await this.userService.findById(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not active');
    }

    // 5. Generar nuevos tokens (rotation)
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // 6. Actualizar sesión con nuevo refresh token
    await this.sessionService.updateSession(session.id_session, {
      refresh_token: newRefreshToken,
      last_activity_at: new Date(),
    });

    // 7. Auditar
    await this.auditService.logSessionRefreshed(
      user.idUser,
      session.id_session,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // =====================================================
  // LOGOUT
  // =====================================================
  async logout(
    userId: string,
    refreshToken: string,
    ip: string,
  ): Promise<{ message: string }> {
    // 1. Revocar sesión
    const session =
      await this.sessionService.revokeSessionByToken(refreshToken);

    if (session) {
      // 2. Auditar
      await this.auditService.logLogout(userId, session.id_session, ip);
    }

    return { message: 'Logged out successfully' };
  }

  // =====================================================
  // RECUPERAR CONTRASEÑA
  // =====================================================
  async recoverPassword(email: string): Promise<{ message: string }> {
    // 1. Buscar usuario
    const user = await this.userService.findByEmail(email);

    // Siempre retornar el mismo mensaje (seguridad: no revelar si email existe)
    const message =
      'If the email exists in our system, you will receive a password reset link.';

    if (!user) {
      return { message };
    }

    // 2. Generar token de reset
    const resetToken = await this.passwordResetService.createToken(
      user.idUser,
    );

    // 3. Enviar email con enlace
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken,
      );
    } catch (error) {
      this.logger.error('Error sending password reset email:', error);
    }

    // 4. Auditar
    await this.auditService.logPasswordResetRequested(email, user.idUser);

    return { message };
  }

  // =====================================================
  // RESTABLECER CONTRASEÑA
  // =====================================================
  async resetPassword(
    token: string,
    password: string,
    confirmPassword: string,
    ip: string,
  ): Promise<{ message: string }> {
    // 1. Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // 2. Validar token
    const resetToken = await this.passwordResetService.validateToken(token);

    // 3. Validar contraseña (mismos requisitos que registro)
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      throw new BadRequestException(
        'Password must include uppercase, lowercase, numbers and special characters',
      );
    }

    // 4. Actualizar contraseña usando UserService
    await this.userService.updatePassword(resetToken.id_user, password, {
      resetFailedAttempts: true,
      unlockAccount: true,
    });

    // 5. Marcar token como usado
    await this.passwordResetService.markAsUsed(resetToken.id_token);

    // 6. Revocar todas las sesiones activas (seguridad)
    await this.sessionService.revokeAllUserSessions(resetToken.id_user);

    // 7. Auditar
    await this.auditService.logPasswordResetCompleted(resetToken.id_user, ip);

    // 8. Notificar por email
    try {
      const user = await this.userService.findById(resetToken.id_user);

      if (user) {
        await this.emailService.sendPasswordChangedNotification(
          user.email,
          user.name,
        );
      }
    } catch (error) {
      this.logger.error('Error sending password changed notification:', error);
    }

    return { message: 'Password reset successfully. Please login again.' };
  }

  // =====================================================
  // CAMBIAR CONTRASEÑA (usuario autenticado)
  // =====================================================
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip: string,
    userAgent: string,
  ): Promise<{ message: string }> {
    // 1. Validar que las contraseñas coincidan
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // 2. Buscar usuario
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 3. Validar contraseña actual
    const isCurrentPasswordValid = await this.userService.validatePassword(
      user,
      dto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 4. Validar que nueva contraseña sea diferente
    const isSamePassword = await this.userService.validatePassword(
      user,
      dto.newPassword,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // 5. Validar nueva contraseña (requisitos de seguridad)
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(dto.newPassword)) {
      throw new BadRequestException(
        'New password must include uppercase, lowercase, numbers and special characters',
      );
    }

    // 6. Actualizar contraseña
    await this.userService.updatePassword(userId, dto.newPassword);

    // 7. Revocar todas las sesiones activas (fuerza re-login)
    await this.sessionService.revokeAllUserSessions(userId);

    // 8. Auditar
    await this.auditService.logPasswordChange(userId, ip, userAgent);

    // 9. Notificar por email
    try {
      await this.emailService.sendPasswordChangedNotification(
        user.email,
        user.name,
      );
    } catch (error) {
      this.logger.error('Error sending password changed notification:', error);
    }

    return {
      message:
        'Password changed successfully. Please login again with your new password.',
    };
  }

  // =====================================================
  // CONSULTAR SESIÓN ACTUAL
  // =====================================================
  async getCurrentSession(userId: string): Promise<{
    activeSessions: number;
    sessions: Array<{
      id: string;
      //ipAddress: string;
      userAgent: string;
      createdAt: Date;
      expiresAt: Date;
    }>;
  }> {
    const sessions = await this.sessionService.getUserActiveSessions(userId);

    return {
      activeSessions: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id_session,
        //ipAddress: s.ip_address || 'Unknown',
        userAgent: s.user_agent || 'Unknown',
        createdAt: s.created_at,
        expiresAt: s.expires_at,
      })),
    };
  }
  
  // =====================================================
  // OBTENER USUARIO ACTUAL (VALIDAR ACCESS TOKEN) 
  // =====================================================

  // src/auth/services/auth.service.ts

// =====================================================
// OBTENER USUARIO ACTUAL (VALIDAR ACCESS TOKEN)
// =====================================================
async getCurrentUser(userId: string): Promise<{
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    status: UserStatus;
  };
  requiresPasswordChange?: boolean;
  requiresProfileCompletion?: boolean;
}> {
  // 1. Buscar usuario
  const user = await this.userService.findById(userId);

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  // 2. Verificar que el usuario siga activo
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedException('Account is not active');
  }

  // 3. Verificar si es tutor y necesita acciones adicionales
  let requiresPasswordChange = false;
  let requiresProfileCompletion = false;

  if (user.role === UserRole.TUTOR) {
    requiresPasswordChange = await this.userService.hasTemporaryPassword(
      user.idUser,
    );
    requiresProfileCompletion = !(await this.tutorService.isProfileComplete(
      user.idUser,
    ));
  }

  return {
    user: {
      id: user.idUser,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: !!user.email_verified_at,
      status: user.status,
    },
    ...(user.role === UserRole.TUTOR && {
      requiresPasswordChange,
      requiresProfileCompletion,
    }),
  };
}

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================
  private generateAccessToken(user: any): string {
    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1h',
    });
  }

  private generateRefreshToken(user: any): string {
    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '30d',
    });
  }
}