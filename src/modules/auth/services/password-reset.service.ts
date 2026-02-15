// src/auth/services/password-reset.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken,'local')
    private tokenRepository: Repository<PasswordResetToken>,
  ) {}

  async createToken(userId: string): Promise<string> {
    // Generar token aleatorio
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    // Invalidar tokens anteriores del usuario
    await this.tokenRepository.update(
      {
        id_user: userId,
        used_at: IsNull(),
      },
      {
        used_at: new Date(),
      },
    );

    // Crear nuevo token
    const resetToken = this.tokenRepository.create({
      id_user: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    });

    await this.tokenRepository.save(resetToken);

    return token; // Retornar token en texto plano (solo esta vez)
  }

  async validateToken(token: string): Promise<PasswordResetToken> {
    const tokens = await this.tokenRepository.find({
      where: {
        used_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    for (const resetToken of tokens) {
      const isMatch = await bcrypt.compare(token, resetToken.token_hash);
      if (isMatch) {
        return resetToken;
      }
    }

    throw new BadRequestException('Invalid or expired token');
  }

  async markAsUsed(tokenId: string): Promise<void> {
    await this.tokenRepository.update(tokenId, {
      used_at: new Date(),
    });
  }
}