import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '../../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: any;
  let studentService: any;
  let tutorService: any;
  let jwtService: any;
  let configService: any;
  let sessionService: any;
  let auditService: any;
  let passwordResetService: any;
  let emailVerificationService: any;
  let emailService: any;

  const mockUser = {
    idUser: 'user-1',
    name: 'Test User',
    email: 'test@udistrital.edu.co',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    locked_until: null,
    failed_login_attempts: 0,
    password_changed_at: new Date(),
    email_verified_at: new Date(),
  };

  beforeEach(() => {
    userService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      existsByEmail: jest.fn(),
      validatePassword: jest.fn(),
      markEmailAsVerified: jest.fn(),
      incrementFailedLoginAttempts: jest.fn(),
      lockAccount: jest.fn(),
      unlockAccount: jest.fn(),
      resetFailedLoginAttempts: jest.fn(),
      updatePassword: jest.fn(),
      hasTemporaryPassword: jest.fn(),
    };
    studentService = { createFromUser: jest.fn() };
    tutorService = { isProfileComplete: jest.fn() };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verify: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue('mock-secret') };
    sessionService = {
      createSession: jest.fn().mockResolvedValue({ id_session: 'session-1' }),
      findValidSession: jest.fn(),
      updateSession: jest.fn(),
      revokeSessionByToken: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      getUserActiveSessions: jest.fn(),
    };
    auditService = {
      log: jest.fn(),
      logEmailVerified: jest.fn(),
      logFailedLogin: jest.fn(),
      logSuccessfulLogin: jest.fn(),
      logSessionRefreshed: jest.fn(),
      logLogout: jest.fn(),
      logPasswordResetRequested: jest.fn(),
      logPasswordResetCompleted: jest.fn(),
      logPasswordChange: jest.fn(),
      logAccountLocked: jest.fn(),
    };
    passwordResetService = {
      createToken: jest.fn(),
      validateToken: jest.fn(),
      markAsUsed: jest.fn(),
    };
    emailVerificationService = {
      createToken: jest.fn().mockResolvedValue('verification-token'),
      validateToken: jest.fn(),
      markAsVerified: jest.fn(),
    };
    emailService = {
      sendEmailConfirmation: jest.fn(),
      sendWelcomeEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      sendPasswordChangedNotification: jest.fn(),
    };

    service = new AuthService(
      userService,
      studentService,
      tutorService,
      jwtService,
      configService,
      sessionService,
      auditService,
      passwordResetService,
      emailVerificationService,
      emailService,
    );
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws BadRequestException if passwords do not match', async () => {
      await expect(
        service.register({
          name: 'Test',
          email: 'test@udistrital.edu.co',
          password: 'Pass1@abc',
          confirmPassword: 'Different1@',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if email is not institutional', async () => {
      await expect(
        service.register({
          name: 'Test',
          email: 'test@gmail.com',
          password: 'Pass1@abc',
          confirmPassword: 'Pass1@abc',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('registers successfully and returns confirmation message', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        idUser: 'user-1',
        email: 'test@udistrital.edu.co',
        name: 'Test',
      });
      studentService.createFromUser.mockResolvedValue(undefined);
      auditService.log.mockResolvedValue(undefined);

      const result = await service.register({
        name: 'Test',
        email: 'test@udistrital.edu.co',
        password: 'Pass1@abc',
        confirmPassword: 'Pass1@abc',
      });

      expect(result.message).toContain('Registration successful');
      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@udistrital.edu.co',
          role: UserRole.STUDENT,
          status: UserStatus.PENDING,
        }),
      );
      expect(studentService.createFromUser).toHaveBeenCalledWith('user-1');
    });

    it('does not throw if confirmation email fails', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockResolvedValue({
        idUser: 'user-1',
        email: 'test@udistrital.edu.co',
        name: 'Test',
      });
      studentService.createFromUser.mockResolvedValue(undefined);
      emailService.sendEmailConfirmation.mockRejectedValue(
        new Error('SMTP error'),
      );
      auditService.log.mockResolvedValue(undefined);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@udistrital.edu.co',
          password: 'Pass1@abc',
          confirmPassword: 'Pass1@abc',
        }),
      ).resolves.toBeDefined();
    });

    it('resends verification email if user exists but is not verified', async () => {
      userService.findByEmail.mockResolvedValue({
        idUser: 'user-1',
        email: 'test@udistrital.edu.co',
        name: 'Test',
        emailVerified: false,
      });

      const result = await service.register({
        name: 'Test',
        email: 'test@udistrital.edu.co',
        password: 'Pass1@abc',
        confirmPassword: 'Pass1@abc',
      });

      expect(result.message).toContain('new verification email');
      expect(emailVerificationService.createToken).toHaveBeenCalledWith(
        'user-1',
      );
      expect(emailService.sendEmailConfirmation).toHaveBeenCalled();
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('throws if email service fails during resend to unverified user', async () => {
      userService.findByEmail.mockResolvedValue({
        idUser: 'user-1',
        email: 'test@udistrital.edu.co',
        name: 'Test',
        emailVerified: false,
      });
      emailService.sendEmailConfirmation.mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(
        service.register({
          name: 'Test',
          email: 'test@udistrital.edu.co',
          password: 'Pass1@abc',
          confirmPassword: 'Pass1@abc',
        }),
      ).rejects.toThrow('SMTP error');

      expect(userService.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if user exists and is already verified', async () => {
      userService.findByEmail.mockResolvedValue({
        idUser: 'user-1',
        email: 'test@udistrital.edu.co',
        name: 'Test',
        emailVerified: true,
      });

      await expect(
        service.register({
          name: 'Test',
          email: 'test@udistrital.edu.co',
          password: 'Pass1@abc',
          confirmPassword: 'Pass1@abc',
        }),
      ).rejects.toThrow(ConflictException);

      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  // ─── confirmEmail ─────────────────────────────────────────────────────────────

  describe('confirmEmail', () => {
    it('verifies email and returns success message', async () => {
      emailVerificationService.validateToken.mockResolvedValue({
        id_token: 't-1',
        id_user: 'user-1',
      });
      emailVerificationService.markAsVerified.mockResolvedValue(undefined);
      userService.markEmailAsVerified.mockResolvedValue(undefined);
      auditService.logEmailVerified.mockResolvedValue(undefined);
      userService.findById.mockResolvedValue(mockUser);
      emailService.sendWelcomeEmail.mockResolvedValue(undefined);

      const result = await service.confirmEmail('valid-token');

      expect(result.message).toContain('Email verified successfully');
      expect(userService.markEmailAsVerified).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── checkEmailExists ─────────────────────────────────────────────────────────

  describe('checkEmailExists', () => {
    it('delegates to userService and returns result', async () => {
      userService.existsByEmail.mockResolvedValue(true);

      const result = await service.checkEmailExists('test@udistrital.edu.co');

      expect(result).toBe(true);
      expect(userService.existsByEmail).toHaveBeenCalledWith(
        'test@udistrital.edu.co',
      );
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException if user is not found', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'notfound@udistrital.edu.co', password: 'pass' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if account is locked', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        service.login(
          { email: mockUser.email, password: 'pass' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('unlocks account automatically if lock period has expired', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() - 1000),
        failed_login_attempts: 5,
      });
      userService.unlockAccount.mockResolvedValue(undefined);
      userService.validatePassword.mockResolvedValue(true);
      userService.resetFailedLoginAttempts.mockResolvedValue(undefined);
      auditService.logSuccessfulLogin.mockResolvedValue(undefined);

      await service.login(
        { email: mockUser.email, password: 'pass' },
        '127.0.0.1',
        'agent',
      );

      expect(userService.unlockAccount).toHaveBeenCalledWith(mockUser.idUser);
    });

    it('locks account and throws after 5 failed password attempts', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        locked_until: null,
      });
      userService.validatePassword.mockResolvedValue(false);
      userService.incrementFailedLoginAttempts.mockResolvedValue(5);
      userService.lockAccount.mockResolvedValue(undefined);
      auditService.logFailedLogin.mockResolvedValue(undefined);
      auditService.logAccountLocked.mockResolvedValue(undefined);

      await expect(
        service.login(
          { email: mockUser.email, password: 'wrong' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(userService.lockAccount).toHaveBeenCalled();
    });

    it('does not lock account and shows remaining attempts on failed password (< 5)', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        locked_until: null,
      });
      userService.validatePassword.mockResolvedValue(false);
      userService.incrementFailedLoginAttempts.mockResolvedValue(2);
      auditService.logFailedLogin.mockResolvedValue(undefined);

      await expect(
        service.login(
          { email: mockUser.email, password: 'wrong' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(userService.lockAccount).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException if account is PENDING (email not verified)', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING,
        locked_until: null,
      });
      userService.validatePassword.mockResolvedValue(true);
      auditService.logFailedLogin.mockResolvedValue(undefined);

      await expect(
        service.login(
          { email: mockUser.email, password: 'pass' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if account is BLOCKED', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.BLOCKED,
        locked_until: null,
      });
      userService.validatePassword.mockResolvedValue(true);
      auditService.logFailedLogin.mockResolvedValue(undefined);

      await expect(
        service.login(
          { email: mockUser.email, password: 'pass' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and user data on successful student login', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        failed_login_attempts: 0,
      });
      userService.validatePassword.mockResolvedValue(true);
      auditService.logSuccessfulLogin.mockResolvedValue(undefined);

      const result = await service.login(
        { email: mockUser.email, password: 'pass' },
        '127.0.0.1',
        'agent',
      );

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
      expect(result.user.role).toBe(UserRole.STUDENT);
      expect(result.requiresPasswordChange).toBeUndefined();
      expect(result.requiresProfileCompletion).toBeUndefined();
    });

    it('includes requiresPasswordChange for tutor with no password_changed_at', async () => {
      userService.findByEmail.mockResolvedValue({
        ...mockUser,
        role: UserRole.TUTOR,
        failed_login_attempts: 0,
        password_changed_at: null,
      });
      userService.validatePassword.mockResolvedValue(true);
      auditService.logSuccessfulLogin.mockResolvedValue(undefined);
      tutorService.isProfileComplete.mockResolvedValue(true);

      const result = await service.login(
        { email: mockUser.email, password: 'pass' },
        '127.0.0.1',
        'agent',
      );

      expect(result.requiresPasswordChange).toBe(true);
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws UnauthorizedException if jwt verification fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('bad-token', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if token type is not refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'access' });

      await expect(
        service.refresh('access-token', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if session is not found or revoked', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });
      sessionService.findValidSession.mockResolvedValue(null);

      await expect(service.refresh('token', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if user is not active', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });
      sessionService.findValidSession.mockResolvedValue({
        id_session: 'session-1',
      });
      userService.findById.mockResolvedValue({
        ...mockUser,
        status: UserStatus.BLOCKED,
      });

      await expect(service.refresh('token', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns new tokens on successful refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });
      sessionService.findValidSession.mockResolvedValue({
        id_session: 'session-1',
      });
      userService.findById.mockResolvedValue(mockUser);
      sessionService.updateSession.mockResolvedValue(undefined);
      auditService.logSessionRefreshed.mockResolvedValue(undefined);

      const result = await service.refresh('valid-token', '127.0.0.1');

      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes session and logs audit on successful logout', async () => {
      sessionService.revokeSessionByToken.mockResolvedValue({
        id_session: 'session-1',
      });
      auditService.logLogout.mockResolvedValue(undefined);

      const result = await service.logout(
        'user-1',
        'refresh-token',
        '127.0.0.1',
      );

      expect(result.message).toBe('Logged out successfully');
      expect(auditService.logLogout).toHaveBeenCalled();
    });

    it('returns success even if session is not found', async () => {
      sessionService.revokeSessionByToken.mockResolvedValue(null);

      const result = await service.logout(
        'user-1',
        'invalid-token',
        '127.0.0.1',
      );

      expect(result.message).toBe('Logged out successfully');
      expect(auditService.logLogout).not.toHaveBeenCalled();
    });
  });

  // ─── recoverPassword ──────────────────────────────────────────────────────────

  describe('recoverPassword', () => {
    it('returns same message when user does not exist (prevents email enumeration)', async () => {
      userService.findByEmail.mockResolvedValue(null);

      const result = await service.recoverPassword('unknown@udistrital.edu.co');

      expect(result.message).toContain('If the email exists');
      expect(passwordResetService.createToken).not.toHaveBeenCalled();
    });

    it('creates reset token and sends email when user exists', async () => {
      userService.findByEmail.mockResolvedValue(mockUser);
      passwordResetService.createToken.mockResolvedValue('reset-token');
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);
      auditService.logPasswordResetRequested.mockResolvedValue(undefined);

      const result = await service.recoverPassword(mockUser.email);

      expect(result.message).toContain('If the email exists');
      expect(passwordResetService.createToken).toHaveBeenCalledWith(
        mockUser.idUser,
      );
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws BadRequestException if passwords do not match', async () => {
      await expect(
        service.resetPassword(
          'token',
          'ValidPass1@',
          'Different1@',
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if new password does not meet security requirements', async () => {
      passwordResetService.validateToken.mockResolvedValue({
        id_token: 't-1',
        id_user: 'user-1',
      });

      await expect(
        service.resetPassword('token', 'simple', 'simple', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('resets password and revokes all active sessions on success', async () => {
      passwordResetService.validateToken.mockResolvedValue({
        id_token: 't-1',
        id_user: 'user-1',
      });
      userService.updatePassword.mockResolvedValue(undefined);
      passwordResetService.markAsUsed.mockResolvedValue(undefined);
      sessionService.revokeAllUserSessions.mockResolvedValue(undefined);
      auditService.logPasswordResetCompleted.mockResolvedValue(undefined);
      userService.findById.mockResolvedValue(mockUser);
      emailService.sendPasswordChangedNotification.mockResolvedValue(undefined);

      const result = await service.resetPassword(
        'token',
        'ValidPass1@',
        'ValidPass1@',
        '127.0.0.1',
      );

      expect(result.message).toContain('Password reset successfully');
      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────────

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'OldPass1@',
      newPassword: 'NewPass1@valid',
      confirmNewPassword: 'NewPass1@valid',
    };

    it('throws BadRequestException if new passwords do not match', async () => {
      await expect(
        service.changePassword(
          'user-1',
          { ...dto, confirmNewPassword: 'Different1@' },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException if user is not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', dto, '127.0.0.1', 'agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if current password is incorrect', async () => {
      userService.findById.mockResolvedValue(mockUser);
      userService.validatePassword.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', dto, '127.0.0.1', 'agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException if new password equals current password', async () => {
      userService.findById.mockResolvedValue(mockUser);
      // First call: current password is correct; second call: same as new
      userService.validatePassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.changePassword(
          'user-1',
          {
            currentPassword: 'SamePass1@',
            newPassword: 'SamePass1@',
            confirmNewPassword: 'SamePass1@',
          },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if new password does not meet security requirements', async () => {
      userService.findById.mockResolvedValue(mockUser);
      userService.validatePassword
        .mockResolvedValueOnce(true) // current password correct
        .mockResolvedValueOnce(false); // new is different

      await expect(
        service.changePassword(
          'user-1',
          {
            currentPassword: 'OldPass1@',
            newPassword: 'simple',
            confirmNewPassword: 'simple',
          },
          '127.0.0.1',
          'agent',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('changes password successfully and revokes all sessions', async () => {
      userService.findById.mockResolvedValue(mockUser);
      userService.validatePassword
        .mockResolvedValueOnce(true) // current password correct
        .mockResolvedValueOnce(false); // new is different from current
      userService.updatePassword.mockResolvedValue(undefined);
      sessionService.revokeAllUserSessions.mockResolvedValue(undefined);
      auditService.logPasswordChange.mockResolvedValue(undefined);
      emailService.sendPasswordChangedNotification.mockResolvedValue(undefined);

      const result = await service.changePassword(
        'user-1',
        dto,
        '127.0.0.1',
        'agent',
      );

      expect(result.message).toContain('Password changed successfully');
      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });
});
