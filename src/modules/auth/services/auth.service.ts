// src/auth/services/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { Student } from '../../student/entities/student.entity';
import { SessionService } from './session.service';
import { AuditService } from './audit-log.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuditAction, AuditResult } from '../entities/audit-log.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private auditService: AuditService,
    private passwordResetService: PasswordResetService,
    private emailVerificationService: EmailVerificationService,
  ) {}

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

    // 3. Verificar que el email no exista
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 4. Hashear contraseña
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 5. Crear usuario con rol STUDENT
    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING,
      password_changed_at: new Date(),
    });

    const savedUser = await this.userRepository.save(user);

    // 6. Crear registro en tabla students
    const student = this.studentRepository.create({
      user: savedUser,
      career: null, // Se completa después
      preferredModality: null,

    });

    await this.studentRepository.save(student);

    // 7. Generar token de verificación de email
    const verificationToken =
      await this.emailVerificationService.createToken(savedUser.idUser);

    // 8. TODO: Enviar email de verificación
    // await this.emailService.sendVerificationEmail(
    //   savedUser.email,
    //   savedUser.name,
    //   verificationToken,
    // );

    console.log('Verification token:', verificationToken); // Temporal para desarrollo

    // 9. Auditar
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

    // 3. Actualizar usuario
    await this.userRepository.update(verificationToken.id_user, {
      email_verified_at: new Date(),
      status: UserStatus.ACTIVE,
    });

    // 4. Auditar
    await this.auditService.logEmailVerified(verificationToken.id_user);

    return { message: 'Email verified successfully. You can now login.' };
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
  }> {
    // 1. Buscar usuario
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

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
      await this.userRepository.update(user.idUser, {
        locked_until: null,
        failed_login_attempts: 0,
      });
      user.locked_until = null;
      user.failed_login_attempts = 0;
    }

    // 4. Validar contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      // Incrementar contador de intentos fallidos
      const newAttempts = user.failed_login_attempts + 1;

      if (newAttempts >= 5) {
        // Bloquear cuenta por 15 minutos
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

        await this.userRepository.update(user.idUser, {
          failed_login_attempts: newAttempts,
          locked_until: lockedUntil,
        });

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
        // Solo incrementar contador
        await this.userRepository.update(user.idUser, {
          failed_login_attempts: newAttempts,
        });

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
      await this.userRepository.update(user.idUser, {
        failed_login_attempts: 0,
      });
    }

    // 7. Generar tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 8. Crear sesión
    const session = await this.sessionService.createSession({
      id_user: user.idUser,
      refresh_token: refreshToken,
      ip_address: ip,
      user_agent: userAgent,
    });

    // 9. Auditar login exitoso
    await this.auditService.logSuccessfulLogin(
      user,
      session.id_session,
      ip,
      userAgent,
    );

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
    const user = await this.userRepository.findOne({
      where: { idUser: payload.sub },
    });

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
    const user = await this.userRepository.findOne({ where: { email } });

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

    // 3. TODO: Enviar email con enlace
    // const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;
    // await this.emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    console.log('Password reset token:', resetToken); // Temporal para desarrollo

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

    // 4. Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Actualizar contraseña
    await this.userRepository.update(resetToken.id_user, {
      password: hashedPassword,
      password_changed_at: new Date(),
      failed_login_attempts: 0, // Resetear intentos fallidos
      locked_until: null, // Desbloquear cuenta
    });

    // 6. Marcar token como usado
    await this.passwordResetService.markAsUsed(resetToken.id_token);

    // 7. Revocar todas las sesiones activas (seguridad)
    await this.sessionService.revokeAllUserSessions(resetToken.id_user);

    // 8. Auditar
    await this.auditService.logPasswordResetCompleted(resetToken.id_user, ip);

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
    const user = await this.userRepository.findOne({
      where: { idUser: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 3. Validar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 4. Validar que nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);

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

    // 6. Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // 7. Actualizar contraseña
    await this.userRepository.update(userId, {
      password: hashedPassword,
      password_changed_at: new Date(),
    });

    // 8. Revocar todas las sesiones activas (fuerza re-login)
    await this.sessionService.revokeAllUserSessions(userId);

    // 9. Auditar
    await this.auditService.logPasswordChange(userId, ip, userAgent);

    return {
      message:
        'Password changed successfully. Please login again with your new password.',
    };
  }

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================
  private generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1h', // 1 hora
    });
  }

  private generateRefreshToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '30d', // 30 días
    });
  }

  // =====================================================
  // CONSULTAR SESIÓN ACTUAL
  // =====================================================
  async getCurrentSession(userId: string): Promise<{
    activeSessions: number;
    sessions: Array<{
      id: string;
      ipAddress: string;
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
        ipAddress: s.ip_address || 'Unknown',
        userAgent: s.user_agent || 'Unknown',
        createdAt: s.created_at,
        expiresAt: s.expires_at,
      })),
    };
  }
}