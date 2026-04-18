// src/auth/services/session.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, LessThan } from 'typeorm';
import { Session } from '../entities/session.entity';
import { User } from '../../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async createSession(data: {
    user: User;
    refresh_token: string;
    user_agent?: string;
  }): Promise<Session> {
    const hashedToken = await bcrypt.hash(data.refresh_token, 10);

    const session = this.sessionRepository.create({
      user: data.user,
      refresh_token_hash: hashedToken,
      user_agent: data.user_agent,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return this.sessionRepository.save(session);
  }

  async findValidSession(refreshToken: string): Promise<Session | null> {
    const sessions = await this.sessionRepository.find({
      where: {
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    for (const session of sessions) {
      const isMatch = await bcrypt.compare(
        refreshToken,
        session.refresh_token_hash,
      );
      if (isMatch) {
        return session;
      }
    }

    return null;
  }

  async updateSession(
    sessionId: string,
    data: { refresh_token?: string; last_activity_at?: Date },
  ): Promise<void> {
    const updateData: Partial<Session> = {};

    if (data.refresh_token) {
      updateData.refresh_token_hash = await bcrypt.hash(
        data.refresh_token,
        10,
      );
    }

    if (data.last_activity_at) {
      updateData.last_activity_at = data.last_activity_at;
    }

    await this.sessionRepository.update(sessionId, updateData);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      revoked_at: new Date(),
    });
  }

  async revokeSessionByToken(refreshToken: string): Promise<Session | null> {
    const session = await this.findValidSession(refreshToken);

    if (session) {
      await this.revokeSession(session.id_session);
    }

    return session;
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      {
        user: { idUser: userId },
        revoked_at: IsNull(),
      },
      {
        revoked_at: new Date(),
      },
    );
  }

  async getUserActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: {
        user: { idUser: userId },
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      order: {
        created_at: 'DESC',
      },
      relations: ['user'],
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.sessionRepository.delete({
      expires_at: LessThan(sevenDaysAgo),
    });

    console.log(`Cleaned up ${result.affected || 0} expired sessions`);
  }
}
