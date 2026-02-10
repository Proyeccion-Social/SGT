// src/auth/services/email-verification.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private tokenRepository: Repository<EmailVerificationToken>,
  ) {}

  async createToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    // Invalidar tokens anteriores
    await this.tokenRepository.update(
      {
        id_user: userId,
        verified_at: IsNull(),
      },
      {
        verified_at: new Date(),
      },
    );

    // Crear nuevo token
    const verificationToken = this.tokenRepository.create({
      id_user: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    });

    await this.tokenRepository.save(verificationToken);

    return token;
  }

  async validateToken(token: string): Promise<EmailVerificationToken> {
    const tokens = await this.tokenRepository.find({
      where: {
        verified_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    for (const verificationToken of tokens) {
      const isMatch = await bcrypt.compare(token, verificationToken.token_hash);
      if (isMatch) {
        return verificationToken;
      }
    }

    throw new BadRequestException('Invalid or expired token');
  }

  async markAsVerified(tokenId: string): Promise<void> {
    await this.tokenRepository.update(tokenId, {
      verified_at: new Date(),
    });
  }
}