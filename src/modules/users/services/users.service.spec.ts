import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './users.service';
import { UserRole, UserStatus } from '../entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

describe('UserService', () => {
  let service: UserService;
  let userRepository: any;

  const mockUser = {
    idUser: 'user-1',
    name: 'Test User',
    email: 'test@udistrital.edu.co',
    password: 'hashed-password',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    emailVerified: true,
    email_verified_at: new Date(),
    password_changed_at: new Date(),
    failed_login_attempts: 0,
    locked_until: null,
  };

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    service = new UserService(userRepository);
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws ConflictException if email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          name: 'Test',
          email: 'test@udistrital.edu.co',
          password: 'pass',
          role: UserRole.STUDENT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('saves user with lowercased email and hashed password', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({ ...mockUser });
      bcryptHash.mockResolvedValue('hashed');

      await service.create({
        name: 'Test',
        email: 'TEST@Udistrital.edu.co',
        password: 'plain-password',
        role: UserRole.STUDENT,
      });

      const savedUser = userRepository.save.mock.calls[0][0];
      expect(savedUser.email).toBe('test@udistrital.edu.co');
      expect(savedUser.password).toBe('hashed');
    });

    it('defaults status to PENDING when not provided', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({ ...mockUser });
      bcryptHash.mockResolvedValue('hashed');

      await service.create({
        name: 'Test',
        email: 'test@udistrital.edu.co',
        password: 'pass',
        role: UserRole.STUDENT,
      });

      expect(userRepository.save.mock.calls[0][0].status).toBe(UserStatus.PENDING);
    });

    it('uses provided status when given', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({ ...mockUser });
      bcryptHash.mockResolvedValue('hashed');

      await service.create({
        name: 'Test',
        email: 'test@udistrital.edu.co',
        password: 'pass',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      });

      expect(userRepository.save.mock.calls[0][0].status).toBe(UserStatus.ACTIVE);
    });
  });

  // ─── createTutorUser ──────────────────────────────────────────────────────────

  describe('createTutorUser', () => {
    it('throws ConflictException if email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.createTutorUser({
          name: 'Tutor',
          email: 'tutor@udistrital.edu.co',
          temporaryPassword: 'temp123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates tutor with ACTIVE status, emailVerified true and null password_changed_at', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({});
      bcryptHash.mockResolvedValue('hashed');

      await service.createTutorUser({
        name: 'Tutor',
        email: 'tutor@udistrital.edu.co',
        temporaryPassword: 'temp123',
      });

      const savedUser = userRepository.save.mock.calls[0][0];
      expect(savedUser.role).toBe(UserRole.TUTOR);
      expect(savedUser.status).toBe(UserStatus.ACTIVE);
      expect(savedUser.emailVerified).toBe(true);
      expect(savedUser.password_changed_at).toBeNull();
    });
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('queries with lowercased email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await service.findByEmail('TEST@Udistrital.edu.co');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@udistrital.edu.co' },
      });
    });

    it('returns null when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@udistrital.edu.co');

      expect(result).toBeNull();
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('returns null when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── findByIds ────────────────────────────────────────────────────────────────

  describe('findByIds', () => {
    it('returns empty array without hitting the database for empty input', async () => {
      const result = await service.findByIds([]);

      expect(result).toEqual([]);
      expect(userRepository.findBy).not.toHaveBeenCalled();
    });

    it('delegates to repository for non-empty id list', async () => {
      userRepository.findBy.mockResolvedValue([mockUser]);

      const result = await service.findByIds(['user-1']);

      expect(result).toEqual([mockUser]);
      expect(userRepository.findBy).toHaveBeenCalled();
    });
  });

  // ─── existsByEmail ────────────────────────────────────────────────────────────

  describe('existsByEmail', () => {
    it('returns true when count is greater than 0', async () => {
      userRepository.count.mockResolvedValue(1);

      expect(await service.existsByEmail('test@udistrital.edu.co')).toBe(true);
    });

    it('returns false when count is 0', async () => {
      userRepository.count.mockResolvedValue(0);

      expect(await service.existsByEmail('unknown@udistrital.edu.co')).toBe(false);
    });
  });

  // ─── isAdmin / isTutor ────────────────────────────────────────────────────────

  describe('isAdmin', () => {
    it('returns true for ADMIN users', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

      expect(await service.isAdmin('user-1')).toBe(true);
    });

    it('returns false for non-ADMIN users', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      expect(await service.isAdmin('user-1')).toBe(false);
    });

    it('returns false when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      expect(await service.isAdmin('nonexistent')).toBe(false);
    });
  });

  describe('isTutor', () => {
    it('returns true for TUTOR users', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, role: UserRole.TUTOR });

      expect(await service.isTutor('user-1')).toBe(true);
    });

    it('returns false for non-TUTOR users', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      expect(await service.isTutor('user-1')).toBe(false);
    });
  });

  // ─── hasTemporaryPassword ─────────────────────────────────────────────────────

  describe('hasTemporaryPassword', () => {
    it('returns true when password_changed_at is null', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, password_changed_at: null });

      expect(await service.hasTemporaryPassword('user-1')).toBe(true);
    });

    it('returns false when password_changed_at has a value', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      expect(await service.hasTemporaryPassword('user-1')).toBe(false);
    });

    it('returns false when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      expect(await service.hasTemporaryPassword('nonexistent')).toBe(false);
    });
  });

  // ─── markEmailAsVerified ──────────────────────────────────────────────────────

  describe('markEmailAsVerified', () => {
    it('updates user with verified status and ACTIVE state', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.markEmailAsVerified('user-1');

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          emailVerified: true,
          status: UserStatus.ACTIVE,
          email_verified_at: expect.any(Date),
        }),
      );
    });
  });

  // ─── updatePassword ───────────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('updates password hash and sets password_changed_at', async () => {
      bcryptHash.mockResolvedValue('new-hash');
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword('user-1', 'new-password');

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          password: 'new-hash',
          password_changed_at: expect.any(Date),
        }),
      );
    });

    it('resets failed_login_attempts when option is set', async () => {
      bcryptHash.mockResolvedValue('new-hash');
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword('user-1', 'new-password', {
        resetFailedAttempts: true,
      });

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ failed_login_attempts: 0 }),
      );
    });

    it('clears locked_until when unlockAccount option is set', async () => {
      bcryptHash.mockResolvedValue('new-hash');
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.updatePassword('user-1', 'new-password', {
        unlockAccount: true,
      });

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ locked_until: null }),
      );
    });
  });

  // ─── incrementFailedLoginAttempts ────────────────────────────────────────────

  describe('incrementFailedLoginAttempts', () => {
    it('throws NotFoundException if user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.incrementFailedLoginAttempts('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('increments counter and returns new value', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, failed_login_attempts: 2 });
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.incrementFailedLoginAttempts('user-1');

      expect(result).toBe(3);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        failed_login_attempts: 3,
      });
    });
  });

  // ─── lockAccount / unlockAccount / resetFailedLoginAttempts ──────────────────

  describe('lockAccount', () => {
    it('updates locked_until with the provided date', async () => {
      const lockDate = new Date(Date.now() + 15 * 60 * 1000);
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.lockAccount('user-1', lockDate);

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        locked_until: lockDate,
      });
    });
  });

  describe('unlockAccount', () => {
    it('clears locked_until and resets failed_login_attempts', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.unlockAccount('user-1');

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        locked_until: null,
        failed_login_attempts: 0,
      });
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('sets failed_login_attempts to 0', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.resetFailedLoginAttempts('user-1');

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        failed_login_attempts: 0,
      });
    });
  });

  // ─── isAccountLocked ──────────────────────────────────────────────────────────

  describe('isAccountLocked', () => {
    it('returns true when locked_until is in the future', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });

      expect(await service.isAccountLocked('user-1')).toBe(true);
    });

    it('returns false when locked_until is in the past', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() - 1000),
      });

      expect(await service.isAccountLocked('user-1')).toBe(false);
    });

    it('returns false when locked_until is null', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      expect(await service.isAccountLocked('user-1')).toBe(false);
    });

    it('returns false when user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      expect(await service.isAccountLocked('nonexistent')).toBe(false);
    });
  });

  // ─── validatePassword ─────────────────────────────────────────────────────────

  describe('validatePassword', () => {
    it('returns true when password matches hash', async () => {
      bcryptCompare.mockResolvedValue(true);

      const result = await service.validatePassword(mockUser as any, 'correct-password');

      expect(result).toBe(true);
    });

    it('returns false when password does not match hash', async () => {
      bcryptCompare.mockResolvedValue(false);

      const result = await service.validatePassword(mockUser as any, 'wrong-password');

      expect(result).toBe(false);
    });
  });
});
