import { BadRequestException } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let tokenRepository: any;

  beforeEach(() => {
    tokenRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      update: jest.fn(),
    };

    service = new EmailVerificationService(tokenRepository);
  });

  // ─── createToken ─────────────────────────────────────────────────────────────

  describe('createToken', () => {
    it('invalidates previous pending tokens for the user', async () => {
      tokenRepository.save.mockResolvedValue({});

      await service.createToken('user-1');

      expect(tokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id_user: 'user-1' }),
        expect.objectContaining({ verified_at: expect.any(Date) }),
      );
    });

    it('saves a new token with a 24h expiry', async () => {
      const beforeCall = Date.now();
      tokenRepository.save.mockResolvedValue({});

      await service.createToken('user-1');

      const savedToken = tokenRepository.save.mock.calls[0][0];
      expect(savedToken.id_user).toBe('user-1');
      expect(savedToken.token_hash).toBeDefined();
      expect(savedToken.expires_at.getTime()).toBeGreaterThanOrEqual(
        beforeCall + 23 * 60 * 60 * 1000,
      );
    });

    it('returns a plain text string token (not the hash)', async () => {
      tokenRepository.save.mockResolvedValue({});

      const token = await service.createToken('user-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // The saved hash must differ from the returned plain text token
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
      // Token hash that will never match 'wrong-token'
      tokenRepository.find.mockResolvedValue([
        { id_token: 't-1', token_hash: 'completely-different-hash' },
      ]);

      await expect(service.validateToken('wrong-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('queries only unverified and non-expired tokens', async () => {
      tokenRepository.find.mockResolvedValue([]);

      await service.validateToken('any-token').catch(() => {});

      expect(tokenRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verified_at: IsNull(),
            expires_at: expect.anything(),
          }),
        }),
      );
    });
  });

  // ─── markAsVerified ───────────────────────────────────────────────────────────

  describe('markAsVerified', () => {
    it('updates the token record with a verified_at timestamp', async () => {
      tokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.markAsVerified('token-id-1');

      expect(tokenRepository.update).toHaveBeenCalledWith(
        'token-id-1',
        expect.objectContaining({ verified_at: expect.any(Date) }),
      );
    });
  });
});
