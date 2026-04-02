import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Session as AuthSession } from '../modules/auth/entities/session.entity';
import { AuditLog, AuditAction, AuditResult } from '../modules/auth/entities/audit-log.entity';
import { EmailVerificationToken } from '../modules/auth/entities/email-verification-token.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { User } from '../modules/users/entities/user.entity';
import * as crypto from 'crypto';

const hash = (val: string) => crypto.createHash('sha256').update(val).digest('hex');

export class AuthSeeder {
  private readonly logger = new Logger(AuthSeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const userRepo = dataSource.getRepository(User);
    const authSessionRepo = dataSource.getRepository(AuthSession);
    const auditLogRepo = dataSource.getRepository(AuditLog);
    const emailTokenRepo = dataSource.getRepository(EmailVerificationToken);
    const passwordTokenRepo = dataSource.getRepository(PasswordResetToken);

    const emails = [
      'admin@sgt.com',
      'carlos.ramirez@sgt.com',
      'maria.hernandez@sgt.com',
      'diego.torres@sgt.com',
      'laura.ospina@sgt.com',
      'sebastian.mora@sgt.com',
    ];

    const now = new Date('2026-03-31T22:00:00-05:00');
    const past7 = new Date('2026-03-24T22:00:00-05:00'); // hace 7 días
    const past3 = new Date('2026-03-28T22:00:00-05:00'); // hace 3 días

    for (const email of emails) {
      const user = await userRepo.findOne({ where: { email } });
      if (!user) { this.logger.warn(`User ${email} not found`); continue; }

      // ─── AUTH SESSION ACTIVA ───────────────────────────────────────────────
      const activeSessionCount = await authSessionRepo
        .createQueryBuilder('s')
        .where('s.id_user = :userId', { userId: user.idUser })
        .getCount();
      if (activeSessionCount === 0) {
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 días
        const activeSession = await authSessionRepo.save(authSessionRepo.create({
          refresh_token_hash: hash(`refresh_${email}_active_${Date.now()}`),
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          expires_at: expiresAt,
          revoked_at: null,
          last_activity_at: now,
          user,
        }));
        this.logger.log(`Active auth session created for ${email}`);

        // ─── AUDIT LOG: LOGIN exitoso ──────────────────────────────────────
        await auditLogRepo.save(auditLogRepo.create({
          id_user: user.idUser,
          id_session: activeSession.id_session,
          action: AuditAction.LOGIN,
          result: AuditResult.SUCCESS,
          email_attempted: email,
          ip_address: '192.168.1.10',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          metadata: { platform: 'web' },
        }));

        // ─── AUTH SESSION EXPIRADA (de 7 días atrás) ──────────────────────
        const expiredSession = await authSessionRepo.save(authSessionRepo.create({
          refresh_token_hash: hash(`refresh_${email}_expired_old`),
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          expires_at: past3, // ya expiró
          revoked_at: past3,
          last_activity_at: past7,
          user,
        }));
        this.logger.log(`Expired auth session created for ${email}`);

        // ─── AUDIT LOG: SESSION expirada ───────────────────────────────────
        await auditLogRepo.save(auditLogRepo.create({
          id_user: user.idUser,
          id_session: expiredSession.id_session,
          action: AuditAction.SESSION_EXPIRED,
          result: AuditResult.SUCCESS,
          email_attempted: email,
          ip_address: '192.168.1.22',
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
          metadata: { reason: 'token_expired' },
        }));
      } else {
        this.logger.log(`Auth sessions already exist for ${email}`);
      }

      // ─── EMAIL VERIFICATION TOKEN (ya usado, expirado) ────────────────────
      const evtCount = await emailTokenRepo.count({ where: { id_user: user.idUser } });
      if (evtCount === 0) {
        await emailTokenRepo.save(emailTokenRepo.create({
          id_user: user.idUser,
          token_hash: hash(`verify_email_${email}`),
          expires_at: past3,
          verified_at: past7, // ya verificado
          user,
        }));
        this.logger.log(`EmailVerificationToken seeded for ${email}`);
      }
    }

    // ─── PASSWORD RESET TOKEN: uno activo, uno expirado ───────────────────────
    const diego = await userRepo.findOne({ where: { email: 'diego.torres@sgt.com' } });
    const laura = await userRepo.findOne({ where: { email: 'laura.ospina@sgt.com' } });

    if (diego) {
      const prtCount = await passwordTokenRepo.count({ where: { id_user: diego.idUser } });
      if (prtCount === 0) {
        // Token activo (expira en 2 horas)
        await passwordTokenRepo.save(passwordTokenRepo.create({
          id_user: diego.idUser,
          token_hash: hash('reset_token_diego_active'),
          expires_at: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          used_at: null,
          user: diego,
        }));
        this.logger.log('Password reset token (active) seeded for Diego');
      }
    }

    if (laura) {
      const prtCount = await passwordTokenRepo.count({ where: { id_user: laura.idUser } });
      if (prtCount === 0) {
        // Token expirado (expiró hace 3 días, ya fue usado)
        await passwordTokenRepo.save(passwordTokenRepo.create({
          id_user: laura.idUser,
          token_hash: hash('reset_token_laura_expired'),
          expires_at: past3,
          used_at: past3,
          user: laura,
        }));
        this.logger.log('Password reset token (expired/used) seeded for Laura');
      }
    }

    this.logger.log('AuthSeeder completed.');
  }
}
