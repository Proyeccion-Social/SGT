// src/auth/services/audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  AuditLog,
  AuditAction,
  AuditResult,
} from '../entities/audit-log.entity';
import { User } from '../../users/entities/user.entity';

interface CreateAuditLogDto {
  id_user?: string | null;
  id_session?: string | null;
  action: AuditAction;
  result: AuditResult;
  email_attempted?: string;
  failure_reason?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog, 'local')
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      const log = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(log);
    } catch (error) {
      // No fallar si auditoría falla (no interrumpir flujo principal)
      console.error('Audit log error:', error);
    }
  }

  async logSuccessfulLogin(
    user: User,
    sessionId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      id_user: user.idUser,
      id_session: sessionId,
      action: AuditAction.LOGIN,
      result: AuditResult.SUCCESS,
      email_attempted: user.email,
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  async logFailedLogin(
    email: string,
    reason: string,
    ip: string,
    userAgent: string,
    userId?: string,
  ): Promise<void> {
    await this.log({
      id_user: userId ?? null,
      action: AuditAction.LOGIN_FAILED,
      result: AuditResult.FAILED,
      email_attempted: email,
      failure_reason: reason,
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  async logLogout(
    userId: string,
    sessionId: string,
    ip: string,
  ): Promise<void> {
    await this.log({
      id_user: userId,
      id_session: sessionId,
      action: AuditAction.LOGOUT,
      result: AuditResult.SUCCESS,
      ip_address: ip,
    });
  }

  async logPasswordChange(
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      id_user: userId,
      action: AuditAction.PASSWORD_CHANGE,
      result: AuditResult.SUCCESS,
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  async logPasswordResetRequested(
    email: string,
    userId: string,
  ): Promise<void> {
    await this.log({
      id_user: userId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      result: AuditResult.SUCCESS,
      email_attempted: email,
    });
  }

  async logPasswordResetCompleted(userId: string, ip: string): Promise<void> {
    await this.log({
      id_user: userId,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      result: AuditResult.SUCCESS,
      ip_address: ip,
    });
  }

  async logEmailVerified(userId: string): Promise<void> {
    await this.log({
      id_user: userId,
      action: AuditAction.EMAIL_VERIFIED,
      result: AuditResult.SUCCESS,
    });
  }

  async logAccountLocked(userId: string, lockedUntil: Date): Promise<void> {
    await this.log({
      id_user: userId,
      action: AuditAction.ACCOUNT_LOCKED,
      result: AuditResult.SUCCESS,
      metadata: { locked_until: lockedUntil.toISOString() },
    });
  }

  async logSessionRefreshed(userId: string, sessionId: string): Promise<void> {
    await this.log({
      id_user: userId,
      id_session: sessionId,
      action: AuditAction.SESSION_REFRESHED,
      result: AuditResult.SUCCESS,
    });
  }

  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    result?: AuditResult;
    from?: Date;
    to?: Date;
    ipAddress?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.created_at', 'DESC');

    if (filters.userId) {
      queryBuilder.andWhere('audit.id_user = :userId', {
        userId: filters.userId,
      });
    }

    if (filters.action) {
      queryBuilder.andWhere('audit.action = :action', {
        action: filters.action,
      });
    }

    if (filters.result) {
      queryBuilder.andWhere('audit.result = :result', {
        result: filters.result,
      });
    }

    if (filters.from && filters.to) {
      queryBuilder.andWhere('audit.created_at BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('audit.ip_address = :ip', {
        ip: filters.ipAddress,
      });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async exportToCSV(filters: {
    from?: Date;
    to?: Date;
    userId?: string;
  }): Promise<string> {
    const { data } = await this.getAuditLogs({ ...filters, limit: 10000 });

    const header =
      'Timestamp,User ID,Email,Action,Result,IP Address,User Agent,Reason\n';

    const rows = data
      .map(
        (log) =>
          `${log.created_at.toISOString()},` +
          `${log.id_user || 'N/A'},` +
          `${log.email_attempted || 'N/A'},` +
          `${log.action},` +
          `${log.result},` +
          `${log.ip_address || 'N/A'},` +
          `"${log.user_agent || 'N/A'}",` +
          `"${log.failure_reason || 'N/A'}"`,
      )
      .join('\n');

    return header + rows;
  }
}
