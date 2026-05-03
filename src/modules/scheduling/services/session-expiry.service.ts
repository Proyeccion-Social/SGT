// src/modules/scheduling/services/session-expiry.service.ts
//
// Cron job que corre cada 15 minutos y procesa dos casos:
//
// CASO 1 — Auto-cancelación de sesiones pendientes de confirmación
//   Condición: status = PENDING_TUTOR_CONFIRMATION
//              AND confirmation_expires_at <= NOW()
//   Acción:    status → EXPIRED_UNCONFIRMED
//              Eliminar ScheduledSession (libera el slot)
//              Notificar al estudiante
//
// CASO 2 — Expiración de propuestas de modificación
//   Condición: status = PENDING (en session_modification_requests)
//              AND expires_at <= NOW()
//   Acción:    status → EXPIRED
//              Si la sesión no tiene otras propuestas PENDING,
//              session.status → SCHEDULED

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';

import { Session } from '../entities/session.entity';
import { ScheduledSession } from '../entities/scheduled-session.entity';
import { StudentParticipateSession } from '../entities/student-participate-session.entity';
import { SessionModificationRequest } from '../entities/session-modification-request.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { ModificationStatus } from '../enums/modification-status.enum';
import { NotificationsService } from '../../notifications/services/notifications.service';

// Añadir EXPIRED_UNCONFIRMED al enum SessionStatus:
// EXPIRED_UNCONFIRMED = 'EXPIRED_UNCONFIRMED'
// (Ver nota al final del archivo)

@Injectable()
export class SessionExpiryService {
  private readonly logger = new Logger(SessionExpiryService.name);

  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(ScheduledSession, 'local')
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,

    @InjectRepository(StudentParticipateSession, 'local')
    private readonly participationRepository: Repository<StudentParticipateSession>,

    @InjectRepository(SessionModificationRequest, 'local')
    private readonly modificationRequestRepository: Repository<SessionModificationRequest>,

    @InjectDataSource('local')
    private readonly dataSource: DataSource,

    private readonly notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CASO 1: Auto-cancelar sesiones pendientes cuyo plazo venció
  // Corre cada 15 minutos. El índice en confirmation_expires_at hace que
  // la query sea eficiente incluso con muchas sesiones pendientes.
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('*/15 * * * *', { name: 'expire-pending-sessions' })
  async expireUnconfirmedSessions(): Promise<void> {
    this.logger.debug('Ejecutando expiración de sesiones sin confirmar...');

    // Obtener todas las sesiones que ya vencieron su plazo de confirmación
    const expiredSessions = await this.sessionRepository.find({
      where: {
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        confirmationExpiresAt: LessThanOrEqual(new Date()),
      },
      relations: [
        'studentParticipateSessions',
        'tutor',
        'tutor.user',
        'subject',
      ],
    });

    if (expiredSessions.length === 0) {
      this.logger.debug('No hay sesiones pendientes vencidas.');
      return;
    }

    this.logger.log(
      `Procesando ${expiredSessions.length} sesión(es) pendiente(s) vencida(s)...`,
    );

    for (const session of expiredSessions) {
      await this.expireSingleSession(session);
    }

    this.logger.log(
      `Expiración completada: ${expiredSessions.length} sesión(es) procesada(s).`,
    );
  }

  private async expireSingleSession(session: Session): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloquear la sesión para evitar race condition con una confirmación
      // manual que llegue en el mismo instante
      const lockedSession = await queryRunner.manager.findOne(Session, {
        where: { idSession: session.idSession },
        lock: { mode: 'pessimistic_write' },
      });

      // Doble verificación: puede haber sido confirmada/rechazada entre
      // el SELECT inicial y el lock
      if (
        !lockedSession ||
        lockedSession.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION
      ) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Marcar como vencida sin confirmar
      lockedSession.status = SessionStatus.EXPIRED_UNCONFIRMED;
      lockedSession.rejectedAt = new Date();
      lockedSession.rejectionReason =
        'El tutor no confirmó la sesión antes del plazo límite (6 horas antes de la sesión).';

      await queryRunner.manager.save(lockedSession);

      // Liberar el slot en scheduled_sessions
      await queryRunner.manager.delete(ScheduledSession, {
        idSession: session.idSession,
      });

      await queryRunner.commitTransaction();

      // Notificar al estudiante (fuera de transacción, no debe romper el flujo)
      const studentId = session.studentParticipateSessions?.[0]?.idStudent;
      if (studentId) {
        this.notificationsService
          .sendSessionRejection(lockedSession, studentId)
          .catch((err) => {
            this.logger.error(
              `Error al notificar expiración al estudiante ${studentId}: ${err.message}`,
            );
          });
      }

      this.logger.log(
        `Sesión ${session.idSession} marcada como EXPIRED_UNCONFIRMED.`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al expirar sesión ${session.idSession}: ${error.message}`,
        error.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASO 2: Expirar propuestas de modificación vencidas
  // Se procesa en el mismo cron de 15 min para no tener dos timers paralelos.
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('*/15 * * * *', { name: 'expire-modification-requests' })
  async expireModificationRequests(): Promise<void> {
    this.logger.debug('Ejecutando expiración de propuestas de modificación...');

    // Una sola query: propuestas PENDING cuyo expires_at ya pasó
    const expiredRequests = await this.modificationRequestRepository.find({
      where: {
        status: ModificationStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
    });

    if (expiredRequests.length === 0) {
      this.logger.debug('No hay propuestas de modificación vencidas.');
      return;
    }

    this.logger.log(
      `Procesando ${expiredRequests.length} propuesta(s) de modificación vencida(s)...`,
    );

    for (const request of expiredRequests) {
      await this.expireSingleModificationRequest(request);
    }

    this.logger.log(
      `Expiración de modificaciones completada: ${expiredRequests.length} procesada(s).`,
    );
  }

  private async expireSingleModificationRequest(
    request: SessionModificationRequest,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock sobre la propuesta para evitar race con respondToModification
      const lockedRequest = await queryRunner.manager.findOne(
        SessionModificationRequest,
        {
          where: { idRequest: request.idRequest },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (
        !lockedRequest ||
        lockedRequest.status !== ModificationStatus.PENDING
      ) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Marcar la propuesta como expirada
      lockedRequest.status = ModificationStatus.EXPIRED;
      await queryRunner.manager.save(lockedRequest);

      // Verificar si la sesión tiene otras propuestas PENDING además de esta
      const remainingPending = await queryRunner.manager.count(
        SessionModificationRequest,
        {
          where: {
            idSession: request.idSession,
            status: ModificationStatus.PENDING,
          },
        },
      );

      // Si no quedan propuestas pendientes, devolver la sesión a SCHEDULED
      if (remainingPending === 0) {
        await queryRunner.manager.update(
          Session,
          {
            idSession: request.idSession,
            status: SessionStatus.PENDING_MODIFICATION,
          },
          { status: SessionStatus.SCHEDULED },
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Propuesta ${request.idRequest} expirada. ` +
          `Sesión ${request.idSession} → ${remainingPending === 0 ? 'SCHEDULED' : 'sigue en PENDING_MODIFICATION'}.`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al expirar propuesta ${request.idRequest}: ${error.message}`,
        error.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
