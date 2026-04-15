import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let tokenRepository: any;

  beforeEach(() => {
    tokenRepository = {
      find: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      update: jest.fn(),
    };

    service = new PasswordResetService(tokenRepository);
  });

  // ─── createToken ─────────────────────────────────────────────────────────────

  describe('createToken', () => {
    it('invalidates previous unused tokens for the user', async () => {
      tokenRepository.save.mockResolvedValue({});

      await service.createToken('user-1');

      expect(tokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id_user: 'user-1' }),
        expect.objectContaining({ used_at: expect.any(Date) }),
      );
    });

    it('saves a new token with a 1h expiry', async () => {
      const beforeCall = Date.now();
      tokenRepository.save.mockResolvedValue({});

      await service.createToken('user-1');

      const savedToken = tokenRepository.save.mock.calls[0][0];
      expect(savedToken.id_user).toBe('user-1');
      expect(savedToken.token_hash).toBeDefined();
      // Expiry should be between 55 and 65 minutes from now
      expect(savedToken.expires_at.getTime()).toBeGreaterThan(
        beforeCall + 55 * 60 * 1000,
      );
      expect(savedToken.expires_at.getTime()).toBeLessThan(
        beforeCall + 65 * 60 * 1000,
      );
    });

    it('returns a plain text string token (not the hash)', async () => {
      tokenRepository.save.mockResolvedValue({});

      const token = await service.createToken('user-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      const savedToken = tokenRepository.save.mock.calls[0][0];
      expect(token).not.toBe(savedToken.token_hash);
    });
  });

  // ─── validateToken ────────────────────────────────────────────────────────────

  describe('validateToken', () => {
    it('throws BadRequestException if no valid tokens exist', async () => {
      tokenRepository.find.mockResolvedValue([]);

      await expect(service.validateToken('any-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if no token hash matches', async () => {
      tokenRepository.find.mockResolvedValue([
        { id_token: 't-1', token_hash: 'completely-different-hash' },
      ]);

      await expect(service.validateToken('wrong-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('queries only unused and non-expired tokens', async () => {
      tokenRepository.find.mockResolvedValue([]);

      await service.validateToken('any-token').catch(() => {});

      expect(tokenRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            used_at: IsNull(),
            expires_at: expect.anything(),
          }),
        }),
      );
    });
  });

  // ─── markAsUsed ───────────────────────────────────────────────────────────────

  describe('markAsUsed', () => {
    it('updates the token record with a used_at timestamp', async () => {
      tokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.markAsUsed('token-id-1');

      expect(tokenRepository.update).toHaveBeenCalledWith(
        'token-id-1',
        expect.objectContaining({ used_at: expect.any(Date) }),
      );
    });
  });
});
