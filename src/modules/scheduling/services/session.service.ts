// src/modules/scheduling/services/session.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { addDays } from 'date-fns';

import { Session } from '../entities/session.entity';
import { ScheduledSession } from '../entities/scheduled-session.entity';
import { StudentParticipateSession } from '../entities/student-participate-session.entity';
import { SessionModificationRequest } from '../entities/session-modification-request.entity';

import { CreateIndividualSessionDto } from '../dto/create-individual-session.dto';
import { CancelSessionDto } from '../dto/cancel-session.dto';
import { ProposeModificationDto } from '../dto/propose-modification.dto';
import { UpdateSessionDetailsDto } from '../dto/update-session-details.dto';
import { ConfirmSessionDto } from '../dto/confirm-session.dto';
import { RejectSessionDto } from '../dto/reject-session.dto';
import {
  SessionFilterDto,
  SessionStatusFilter,
} from '../dto/session-filter.dto';

import { SessionType } from '../enums/session-type.enum';
import { SessionStatus } from '../enums/session-status.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';
import { ModificationStatus } from '../enums/modification-status.enum';

import { SessionValidationService } from './session-validation.service';
import { AvailabilityService } from '../../availability/services/availability.service';
import { TutorService } from '../../tutor/services/tutor.service';
import { UserService } from '../../users/services/users.service';
import { SubjectsService } from '../../subjects/services/subjects.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { buildPaginatedResponse } from '../../common/helpers/pagination.helper';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(ScheduledSession, 'local')
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,

    @InjectRepository(StudentParticipateSession, 'local')
    private readonly studentParticipateRepository: Repository<StudentParticipateSession>,

    @InjectRepository(SessionModificationRequest, 'local')
    private readonly modificationRequestRepository: Repository<SessionModificationRequest>,

    @InjectDataSource('local')
    private readonly dataSource: DataSource,

    private readonly validationService: SessionValidationService,
    private readonly availabilityService: AvailabilityService,
    private readonly tutorService: TutorService,
    private readonly userService: UserService,
    private readonly subjectsService: SubjectsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-19 / RF-20: CREAR SESIÓN INDIVIDUAL
  // ═══════════════════════════════════════════════════════════════════════════

  async createIndividualSession(
    studentId: string,
    dto: CreateIndividualSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Validaciones de dominio (fuera de transacción, sin locks) ──────

      this.validationService.validateStudentNotTutor(studentId, dto.tutorId);
      await this.tutorService.validateTutorActive(dto.tutorId);

      const availability = await this.availabilityService.getAvailabilityById(
        dto.availabilityId,
      );
      const startTime = availability.startTime;
      const endTime = this.validationService.calculateEndTime(
        startTime,
        dto.durationHours,
      );

      // Modalidad coincide con la franja del tutor
      await this.validationService.validateModality(
        dto.availabilityId,
        dto.tutorId,
        dto.modality,
      );

      //  NUEVO — validar coherencia día-slot
      await this.validationService.validateScheduledDateMatchesSlotDay(
        dto.availabilityId,
        dto.scheduledDate, // string
      );

      // Slot disponible para esa fecha + duración completa (Cara 1 y Cara 2).
      // Esta llamada verifica:
      //   a) Que el tutor tiene franjas registradas suficientes para cubrir durationHours.
      //   b) Que ningún slot dentro del bloque esté ya ocupado por una sesión activa,
      //      incluyendo sesiones que comenzaron antes y cuyo bloque se extiende hasta aquí.
      //   c) Que el mismo slot para UNA FECHA DIFERENTE no bloquee este agendamiento
      //      (la validación filtra siempre por scheduledDate).
      await this.validationService.validateAvailabilitySlotWithDuration(
        dto.tutorId,
        dto.availabilityId,
        dto.scheduledDate,
        dto.durationHours,
        // Sin excludeSessionId: es una sesión nueva, no hay nada que excluir.
      );

      // No hay sesiones SCHEDULED ni PENDING_MODIFICATION solapadas en el mismo día
      await this.validationService.validateNoTimeConflict(
        dto.tutorId,
        dto.scheduledDate,
        startTime,
        dto.durationHours,
      );

      // No supera el límite semanal del tutor
      await this.validationService.validateWeeklyHoursLimit(
        dto.tutorId,
        dto.scheduledDate,
        dto.durationHours,
      );

      // No supera el límite diario del tutor (máximo 4 horas por día).
      // Esta validación debe correr dentro de la misma transacción y tomando
      // lock sobre las sesiones del tutor en la fecha para evitar carreras
      // entre requests concurrentes en slots distintos del mismo día.
      const dailyHoursRaw = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .select('COALESCE(SUM(session.durationHours), 0)', 'totalHours')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: new Date(dto.scheduledDate),
        })
        .andWhere('session.status IN (:...statuses)', {
          statuses: [
            SessionStatus.SCHEDULED,
            SessionStatus.PENDING_MODIFICATION,
          ],
        })
        .setLock('pessimistic_write')
        .getRawOne<{ totalHours: string }>();
      const existingDailyHours = Number(dailyHoursRaw?.totalHours ?? 0);
      if (existingDailyHours + dto.durationHours > 4) {
        throw new BadRequestException(
          'El tutor no puede superar 4 horas de sesiones en un mismo día.',
        );
      }

      // ── 2. Verificación de concurrencia con lock pesimista ────────────────
      //
      // Aquí solo bloqueamos si hay OTRA sesión CONFIRMADA (SCHEDULED) en el
      // SLOT EXACTO + FECHA. Esto es la última línea de defensa ante condiciones
      // de carrera cuando dos estudiantes envían la misma solicitud simultáneamente.
      // Para bloques de 1h/1.5h el solapamiento ya fue rechazado arriba con
      // validateAvailabilitySlotWithDuration, que consulta por rango de minutos.

      const confirmedInSlot = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: dto.availabilityId,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: new Date(dto.scheduledDate),
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.SCHEDULED,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (confirmedInSlot) {
        throw new BadRequestException(
          'Esta franja ya fue confirmada para otro estudiante. Por favor elige otro horario.',
        );
      }

      // Contar solicitudes pendientes para el mismo slot+fecha (solo informativo)
      const pendingCount = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: dto.availabilityId,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: new Date(dto.scheduledDate),
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        })
        .getCount();

      // ── 3. Persistir ──────────────────────────────────────────────────────

      const session = queryRunner.manager.create(Session, {
        idTutor: dto.tutorId,
        idSubject: dto.subjectId,
        scheduledDate: dto.scheduledDate,
        startTime,
        endTime,
        type: SessionType.INDIVIDUAL,
        modality: dto.modality,
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        title: dto.title,
        description: dto.description,
        tutorConfirmed: false,
      });

      const savedSession = await queryRunner.manager.save(session);

      // ScheduledSession registra qué slot de disponibilidad quedó comprometido
      await queryRunner.manager.save(
        queryRunner.manager.create(ScheduledSession, {
          idSession: savedSession.idSession,
          idTutor: dto.tutorId,
          idAvailability: dto.availabilityId,
          scheduledDate: dto.scheduledDate,
        }),
      );

      await queryRunner.manager.save(
        queryRunner.manager.create(StudentParticipateSession, {
          idStudent: studentId,
          idSession: savedSession.idSession,
          status: ParticipationStatus.CONFIRMED,
        }),
      );

      await queryRunner.commitTransaction();

      // ── 4. Notificaciones (fuera de transacción) ──────────────────────────

      await this.fireAndLogNotifications([
        this.sendTutorConfirmationRequestNotification(savedSession, studentId),
        this.sendStudentRequestAckNotification(savedSession, studentId),
      ]);

      return {
        success: true,
        message:
          pendingCount > 0
            ? `Solicitud enviada. Hay ${pendingCount} solicitud(es) pendiente(s) para este horario. El tutor elegirá una.`
            : 'Solicitud enviada al tutor. Recibirás una notificación cuando confirme.',
        session: await this.getSessionById(savedSession.idSession),
        pendingRequestsCount: pendingCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // El constraint UQ_tutor_availability_date de BD es la última red de seguridad
      if (error.code === '23505') {
        throw new BadRequestException(
          'Esta franja ya está ocupada. Por favor elige otro horario.',
        );
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-20: CONFIRMAR SESIÓN (TUTOR)
  // ═══════════════════════════════════════════════════════════════════════════

  async confirmSession(
    tutorId: string,
    sessionId: string,
    dto: ConfirmSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const session = await queryRunner.manager
        .createQueryBuilder(Session, 'session')
        .where('session.idSession = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) throw new NotFoundException('Session not found');

      if (session.idTutor !== tutorId) {
        throw new ForbiddenException(
          'Solo el tutor asignado puede confirmar esta sesión',
        );
      }
      if (session.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION) {
        throw new BadRequestException(
          `No se puede confirmar una sesión con estado ${session.status}`,
        );
      }

      const scheduledSession = await queryRunner.manager.findOne(
        ScheduledSession,
        {
          where: { idSession: sessionId },
        },
      );
      if (!scheduledSession)
        throw new NotFoundException('ScheduledSession not found');

      // Verificar que no haya otra sesión SCHEDULED en la misma franja+fecha
      const conflicting = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: scheduledSession.idAvailability,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: scheduledSession.scheduledDate,
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.SCHEDULED,
        })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (conflicting) {
        throw new BadRequestException(
          'Esta franja ya fue confirmada para otro estudiante.',
        );
      }

      // Validar que la confirmación no cause que se exceda el límite diario.
      // Esta validación debe hacerse dentro de la misma transacción y con lock
      // sobre las sesiones del tutor en el día para evitar carreras entre
      // confirmaciones concurrentes de distintas franjas del mismo día.
      const sessionDuration = this.calcDuration(session);
      const daySessions = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoinAndSelect('ss.session', 'daySession')
        .where('ss.idTutor = :tutorId', { tutorId })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: scheduledSession.scheduledDate,
        })
        .orderBy('ss.idSession', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const alreadyScheduledMinutes = daySessions.reduce(
        (total, dayScheduled) => {
          if (
            dayScheduled.idSession === sessionId ||
            !dayScheduled.session ||
            dayScheduled.session.status !== SessionStatus.SCHEDULED
          ) {
            return total;
          }
          return total + this.calcDuration(dayScheduled.session);
        },
        0,
      );
      const maxDailyMinutes = 4 * 60;
      if (alreadyScheduledMinutes + sessionDuration > maxDailyMinutes) {
        throw new BadRequestException(
          'La confirmación excede el límite diario de 4 horas para el tutor.',
        );
      }

      // Confirmar
      session.status = SessionStatus.SCHEDULED;
      session.tutorConfirmed = true;
      session.tutorConfirmedAt = new Date();
      await queryRunner.manager.save(session);

      // Auto-rechazar otras solicitudes pendientes en la misma franja+fecha
      const otherPending = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoinAndSelect('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: scheduledSession.idAvailability,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: scheduledSession.scheduledDate,
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .getMany();

      const autoRejectedData: Array<{ session: Session; studentId: string }> =
        [];

      for (const other of otherPending) {
        other.session.status = SessionStatus.REJECTED_BY_TUTOR;
        other.session.rejectionReason =
          'El tutor ya confirmó otra sesión para este horario';
        other.session.rejectedAt = new Date();
        await queryRunner.manager.save(other.session);

        const participation = await queryRunner.manager.findOne(
          StudentParticipateSession,
          {
            where: { idSession: other.session.idSession },
            select: ['idStudent'],
          },
        );

        if (participation?.idStudent) {
          autoRejectedData.push({
            session: other.session,
            studentId: participation.idStudent,
          });
        }

        await queryRunner.manager.remove(other);
      }

      const confirmedParticipation = await queryRunner.manager.findOne(
        StudentParticipateSession,
        { where: { idSession: sessionId }, select: ['idStudent'] },
      );
      if (!confirmedParticipation) {
        throw new NotFoundException(
          'No se encontró el estudiante asociado a esta sesión',
        );
      }

      await queryRunner.commitTransaction();

      // Notificaciones
      await this.fireAndLogNotifications([
        this.sendConfirmationEmailsNotification(
          session,
          confirmedParticipation.idStudent,
        ),
      ]);

      await this.fireAndLogNotifications(
        autoRejectedData.map(({ session: s, studentId }) =>
          this.notificationsService.sendSessionRejection(s, studentId),
        ),
      );

      return {
        success: true,
        message: 'Sesión confirmada exitosamente',
        autoRejectedCount: otherPending.length,
        session: await this.getSessionById(sessionId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-20: RECHAZAR SESIÓN (TUTOR)
  // ═══════════════════════════════════════════════════════════════════════════

  async rejectSession(
    tutorId: string,
    sessionId: string,
    dto: RejectSessionDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: [
        'studentParticipateSessions',
        'tutor',
        'tutor.user',
        'subject',
      ],
    });
    if (!session) throw new NotFoundException('Session not found');

    if (session.idTutor !== tutorId) {
      throw new ForbiddenException(
        'Solo el tutor asignado puede rechazar esta sesión',
      );
    }
    if (session.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION) {
      throw new BadRequestException(
        `No se puede rechazar una sesión con estado ${session.status}`,
      );
    }

    session.status = SessionStatus.REJECTED_BY_TUTOR;
    session.rejectionReason = dto.reason;
    session.rejectedAt = new Date();
    await this.sessionRepository.save(session);

    await this.scheduledSessionRepository.delete({ idSession: sessionId });

    const studentId = session.studentParticipateSessions[0]?.idStudent;
    if (studentId) {
      await this.fireAndLogNotifications([
        this.notificationsService.sendSessionRejection(session, studentId),
      ]);
    }

    return {
      success: true,
      message: 'Sesión rechazada. Se ha notificado al estudiante.',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-21: CANCELAR SESIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async cancelSession(
    userId: string,
    sessionId: string,
    dto: CancelSessionDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: [
        'studentParticipateSessions',
        'studentParticipateSessions.student',
        'studentParticipateSessions.student.user', // ← Para obtener student.user.name
        'tutor',
        'tutor.user', // ← Para obtener tutor.user.name
        'subject',
      ],
    });
    if (!session) throw new NotFoundException('Session not found');

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;
    const isAdmin = await this.userService.isAdmin(userId);

    if (!isParticipant && !isTutor && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para cancelar esta sesión',
      );
    }
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `No se puede cancelar una sesión con estado ${session.status}`,
      );
    }

    const canCancelWithAtLeast24Hours =
      this.validationService.validateCancellationTime(
        session.scheduledDate,
        session.startTime,
      );

    if (!canCancelWithAtLeast24Hours && !isAdmin) {
      throw new BadRequestException(
        'Solo puedes cancelar con al menos 24 horas de anticipación',
      );
    }

    session.status = isParticipant
      ? SessionStatus.CANCELLED_BY_STUDENT
      : isTutor
        ? SessionStatus.CANCELLED_BY_TUTOR
        : SessionStatus.CANCELLED_BY_ADMIN;
    session.cancellationReason = dto.reason;
    session.cancelledAt = new Date();
    session.cancelledWithin24h = !canCancelWithAtLeast24Hours;
    session.cancelledBy = userId;
    await this.sessionRepository.save(session);

    await this.scheduledSessionRepository.delete({ idSession: sessionId });

    await this.fireAndLogNotifications([
      this.notificationsService.sendSessionCancellation(session, userId),
    ]);

    return { success: true, message: 'Sesión cancelada exitosamente' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-22: PROPONER MODIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async proposeModification(
    userId: string,
    sessionId: string,
    dto: ProposeModificationDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'subject'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta sesión',
      );
    }

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Solo puedes modificar sesiones en estado SCHEDULED',
      );
    }

    if (
      !dto.newScheduledDate &&
      !dto.newAvailabilityId &&
      !dto.newModality &&
      !dto.newDurationHours
    ) {
      throw new BadRequestException('Debes proponer al menos un cambio');
    }

    // ========================================
    // VALIDACIONES DE CAMBIO TEMPORAL
    // ========================================
    if (dto.newScheduledDate || dto.newAvailabilityId || dto.newDurationHours) {
      const newDate: string = dto.newScheduledDate ?? session.scheduledDate;

      const newDuration = dto.newDurationHours ?? this.calcDuration(session);

      let effectiveAvailabilityId: number;

      if (dto.newAvailabilityId) {
        effectiveAvailabilityId = dto.newAvailabilityId;
      } else {
        const currentScheduledSession =
          await this.scheduledSessionRepository.findOne({
            where: { idSession: sessionId },
          });

        if (!currentScheduledSession) {
          throw new NotFoundException(
            'ScheduledSession not found for this session',
          );
        }

        effectiveAvailabilityId = currentScheduledSession.idAvailability;
      }

      // ========================================
      // NUEVA VALIDACIÓN CRÍTICA (dayOfWeek vs fecha)
      // ========================================
      await this.validationService.validateScheduledDateMatchesSlotDay(
        effectiveAvailabilityId,
        newDate,
      );

      // ========================================
      // VALIDACIÓN DE DISPONIBILIDAD + DURACIÓN
      // ========================================
      await this.validationService.validateAvailabilitySlotWithDuration(
        session.idTutor,
        effectiveAvailabilityId,
        newDate,
        newDuration,
        session.idSession,
      );

      // ========================================
      // VALIDACIÓN DE MODALIDAD (solo si cambia slot)
      // ========================================
      if (dto.newAvailabilityId) {
        const newModality = dto.newModality ?? session.modality;

        await this.validationService.validateModality(
          effectiveAvailabilityId,
          session.idTutor,
          newModality,
        );
      }

      // ========================================
      // VALIDACIÓN DE CONFLICTO DE HORARIO
      // ========================================
      let newStartTime = session.startTime;

      if (dto.newAvailabilityId) {
        const newAvailability =
          await this.availabilityService.getAvailabilityById(
            dto.newAvailabilityId,
          );

        newStartTime = newAvailability.startTime;
      }

      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
        session.idSession,
      );

      // ========================================
      // VALIDACIÓN DE LÍMITE SEMANAL
      // ========================================
      await this.validationService.validateWeeklyHoursLimit(
        session.idTutor,
        newDate,
        newDuration,
        session.idSession,
      );

      // ========================================
      // VALIDACIÓN DE LÍMITE DIARIO
      // ========================================
      await this.validationService.validateDailyHoursLimit(
        session.idTutor,
        newDate,
        newDuration,
        session.idSession,
      );
    }

    // ========================================
    // CREACIÓN DE SOLICITUD
    // ========================================
    const expiresAt = addDays(new Date(), 1);

    const modificationRequest = new SessionModificationRequest();
    modificationRequest.idSession = sessionId;
    modificationRequest.requestedBy = userId;
    modificationRequest.newScheduledDate = dto.newScheduledDate ?? undefined;
    modificationRequest.newAvailabilityId = dto.newAvailabilityId ?? undefined;
    modificationRequest.newModality = dto.newModality ?? undefined;
    modificationRequest.newDurationHours = dto.newDurationHours ?? undefined;
    modificationRequest.status = ModificationStatus.PENDING;
    modificationRequest.expiresAt = expiresAt;

    const savedRequest =
      await this.modificationRequestRepository.save(modificationRequest);

    // ========================================
    // ACTUALIZAR ESTADO DE SESIÓN
    // ========================================
    session.status = SessionStatus.PENDING_MODIFICATION;
    await this.sessionRepository.save(session);

    // ========================================
    // NOTIFICACIONES
    // ========================================
    await this.fireAndLogNotifications([
      this.notificationsService.sendModificationRequest(
        session,
        userId,
        savedRequest,
      ),
    ]);

    return {
      success: true,
      message: 'Modificación propuesta exitosamente',
      requestId: savedRequest.idRequest,
      expiresAt,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-22: RESPONDER A PROPUESTA DE MODIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async respondToModification(
    userId: string,
    sessionId: string,
    accept: boolean,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const session = await queryRunner.manager.findOne(Session, {
        where: { idSession: sessionId },
        // Necesitamos la materia para el email de notificación
        relations: ['subject'],
      });
      if (!session) throw new NotFoundException('Session not found');

      const pendingRequest = await queryRunner.manager.findOne(
        SessionModificationRequest,
        {
          where: { idSession: sessionId, status: ModificationStatus.PENDING },
        },
      );
      if (!pendingRequest)
        throw new NotFoundException('No pending modification request');

      const participations = await queryRunner.manager.find(
        StudentParticipateSession,
        {
          where: { idSession: sessionId },
          select: ['idStudent'],
        },
      );

      const isParticipant = participations.some((p) => p.idStudent === userId);
      const isTutor = session.idTutor === userId;

      if (!isParticipant && !isTutor) {
        throw new ForbiddenException('No tienes permiso para responder');
      }
      if (pendingRequest.requestedBy === userId) {
        throw new BadRequestException(
          'No puedes responder tu propia solicitud',
        );
      }

      // Verificar expiración
      if (new Date() > pendingRequest.expiresAt) {
        pendingRequest.status = ModificationStatus.EXPIRED;
        session.status = SessionStatus.SCHEDULED;
        await queryRunner.manager.save(pendingRequest);
        await queryRunner.manager.save(session);
        await queryRunner.commitTransaction();
        throw new BadRequestException('La solicitud ha expirado');
      }

      // ── RECHAZAR ──────────────────────────────────────────────────────────

      if (!accept) {
        session.status = SessionStatus.SCHEDULED;
        pendingRequest.status = ModificationStatus.REJECTED;
        pendingRequest.respondedBy = userId;
        pendingRequest.respondedAt = new Date();

        await queryRunner.manager.save(session);
        await queryRunner.manager.save(pendingRequest);
        await queryRunner.commitTransaction();

        await this.fireAndLogNotifications([
          this.notificationsService.sendModificationResponse(
            session,
            pendingRequest,
            false,
          ),
        ]);

        return { success: true, message: 'Modificación rechazada' };
      }

      // ── ACEPTAR ───────────────────────────────────────────────────────────

      const newDuration =
        pendingRequest.newDurationHours ?? this.calcDuration(session);
      const newDate = pendingRequest.newScheduledDate ?? session.scheduledDate;

      const scheduledSession = await queryRunner.manager.findOne(
        ScheduledSession,
        {
          where: { idSession: sessionId },
        },
      );
      if (!scheduledSession)
        throw new NotFoundException('ScheduledSession not found');

      let newStartTime = session.startTime;

      if (pendingRequest.newAvailabilityId) {
        const newAvailability =
          await this.availabilityService.getAvailabilityById(
            pendingRequest.newAvailabilityId,
          );
        newStartTime = newAvailability.startTime;
        scheduledSession.idAvailability = pendingRequest.newAvailabilityId;
      }

      // Re-validar disponibilidad al momento de aceptar.
      // Pueden haber pasado hasta 24h desde que se propuso: alguien más pudo
      // haber reservado ese slot en ese tiempo.
      await this.validationService.validateAvailabilitySlotWithDuration(
        session.idTutor,
        scheduledSession.idAvailability,
        newDate,
        newDuration,
        session.idSession, // excluir la sesión actual
      );

      // Re-validar solapamiento de horario con otras sesiones
      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
        session.idSession,
      );

      // Re-validar límite diario antes de aceptar la modificación
      await this.validationService.validateDailyHoursLimit(
        session.idTutor,
        newDate,
        newDuration,
        session.idSession,
      );

      // Aplicar cambios
      session.scheduledDate = newDate;
      scheduledSession.scheduledDate = newDate;
      session.startTime = newStartTime;
      session.endTime = this.validationService.calculateEndTime(
        newStartTime,
        newDuration,
      );
      if (pendingRequest.newModality)
        session.modality = pendingRequest.newModality;
      session.status = SessionStatus.SCHEDULED;

      await queryRunner.manager.save(scheduledSession);
      await queryRunner.manager.save(session);

      pendingRequest.status = ModificationStatus.ACCEPTED;
      pendingRequest.respondedBy = userId;
      pendingRequest.respondedAt = new Date();
      await queryRunner.manager.save(pendingRequest);

      await queryRunner.commitTransaction();

      await this.fireAndLogNotifications([
        this.notificationsService.sendModificationResponse(
          session,
          pendingRequest,
          true,
        ),
      ]);

      return { success: true, message: 'Modificación aceptada exitosamente' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RF-22: ACTUALIZAR DETALLES (título, descripción, location, virtualLink)
  // ═══════════════════════════════════════════════════════════════════════════

  async updateSessionDetails(
    userId: string,
    sessionId: string,
    dto: UpdateSessionDetailsDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'subject'],
    });
    if (!session) throw new NotFoundException('Session not found');

    const previousDetails = {
      title: session.title,
      description: session.description,
      location: session.location ?? null,
      virtualLink: session.virtualLink ?? null,
    };

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta sesión',
      );
    }

    const sessionDateTime = new Date(session.scheduledDate);
    const [h, m] = session.startTime.split(':').map(Number);
    sessionDateTime.setHours(h, m, 0, 0);

    if (new Date() >= sessionDateTime) {
      throw new BadRequestException(
        'No puedes modificar una sesión que ya ha iniciado',
      );
    }

    if (dto.title !== undefined) {
      if (dto.title === null)
        throw new BadRequestException('El título no puede ser nulo');
      session.title = dto.title;
    }
    if (dto.description !== undefined) {
      if (dto.description === null)
        throw new BadRequestException('La descripción no puede ser nula');
      session.description = dto.description;
    }
    if (dto.location !== undefined) session.location = dto.location ?? null;
    if (dto.virtualLink !== undefined)
      session.virtualLink = dto.virtualLink ?? null;

    const changes = [
      dto.title !== undefined && dto.title !== previousDetails.title
        ? {
            label: 'Título',
            previous: previousDetails.title,
            current: session.title,
          }
        : null,
      dto.description !== undefined &&
      dto.description !== previousDetails.description
        ? {
            label: 'Descripción',
            previous: previousDetails.description,
            current: session.description,
          }
        : null,
      dto.location !== undefined && dto.location !== previousDetails.location
        ? {
            label: 'Ubicación',
            previous: previousDetails.location,
            current: session.location ?? null,
          }
        : null,
      dto.virtualLink !== undefined &&
      dto.virtualLink !== previousDetails.virtualLink
        ? {
            label: 'Enlace virtual',
            previous: previousDetails.virtualLink,
            current: session.virtualLink ?? null,
          }
        : null,
    ].filter(
      (
        change,
      ): change is {
        label: string;
        previous: string | null;
        current: string | null;
      } => change !== null,
    );

    await this.sessionRepository.save(session);

    await this.fireAndLogNotifications([
      this.notificationsService.sendSessionDetailsUpdate(session, changes),
    ]);

    return {
      success: true,
      message: 'Detalles de la sesión actualizados exitosamente',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getSessionById(sessionId: string) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: [
        'tutor',
        'tutor.user',
        'subject',
        'studentParticipateSessions',
        'studentParticipateSessions.student',
        'studentParticipateSessions.student.user',
        'scheduledSession',
        'scheduledSession.availability',
      ],
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.mapToDetailedDto(session);
  }

  async getModificationRequestById(requestId: string) {
    const request = await this.modificationRequestRepository.findOne({
      where: { idRequest: requestId },
    });
    if (!request) throw new NotFoundException('Modification request not found');
    return request;
  }

  async getModificationsRequestBySessionId(sessionId: string) {
    return this.modificationRequestRepository.find({
      where: { idSession: sessionId },
      order: { requestedAt: 'DESC' },
    });
  }

  async getMySessionsAsStudent(studentId: string, filters: SessionFilterDto) {
    const { page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;
    const { statuses, isNoShow } = this.resolveStatusFilter(filters.status);

    const qb = this.studentParticipateRepository
      .createQueryBuilder('participation')
      .innerJoinAndSelect('participation.session', 'session')
      .innerJoinAndSelect('session.tutor', 'tutor')
      .innerJoinAndSelect('tutor.user', 'tutorUser')
      .innerJoinAndSelect('session.subject', 'subject')
      .leftJoinAndSelect(
        'session.studentParticipateSessions',
        'allParticipations',
      )
      .leftJoinAndSelect('allParticipations.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .where('participation.idStudent = :studentId', { studentId })
      .orderBy('session.scheduledDate', 'DESC')
      .addOrderBy('session.startTime', 'DESC');

    if (statuses) qb.andWhere('session.status IN (:...statuses)', { statuses });
    if (isNoShow) {
      qb.andWhere('participation.status = :absentStatus', {
        absentStatus: ParticipationStatus.ABSENT,
      });
    }

    const [participations, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return buildPaginatedResponse(
      participations.map((p) => this.mapToListDto(p.session)),
      total,
      page,
      limit,
    );
  }

  async getMySessionsAsTutor(tutorId: string, filters: SessionFilterDto) {
    const { page = 1, limit = 10, status } = filters;
    const offset = (page - 1) * limit;
    const { statuses } = this.resolveStatusFilter(status);

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.tutor', 'tutor')
      .innerJoinAndSelect('tutor.user', 'tutorUser')
      .innerJoinAndSelect('session.subject', 'subject')
      .leftJoinAndSelect('session.studentParticipateSessions', 'participation')
      .leftJoinAndSelect('participation.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .where('session.idTutor = :tutorId', { tutorId })
      .orderBy('session.scheduledDate', 'DESC')
      .addOrderBy('session.startTime', 'DESC');

    if (statuses?.length)
      qb.andWhere('session.status IN (:...statuses)', { statuses });

    const [sessions, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return buildPaginatedResponse(
      sessions.map((s) => this.mapToListDto(s)),
      total,
      page,
      limit,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS — NOTIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  private async fireAndLogNotifications(
    promises: Promise<void>[],
  ): Promise<void> {
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(
          '[SessionService] Fallo al enviar notificación:',
          result.reason,
        );
      }
    }
  }

  private async sendTutorConfirmationRequestNotification(
    session: Session,
    studentId: string,
  ): Promise<void> {
    const full = await this.getSessionById(session.idSession);
    await this.notificationsService.sendTutorConfirmationRequest(
      full,
      studentId,
    );
  }

  private async sendStudentRequestAckNotification(
    session: Session,
    studentId: string,
  ): Promise<void> {
    const full = await this.getSessionById(session.idSession);
    await this.notificationsService.sendStudentSessionRequestAck(
      full,
      studentId,
    );
  }

  private async sendConfirmationEmailsNotification(
    session: Session,
    confirmedStudentId: string,
  ): Promise<void> {
    const full = await this.getSessionById(session.idSession);
    await Promise.all([
      this.notificationsService.sendSessionConfirmationStudent(
        full,
        confirmedStudentId,
      ),
      this.notificationsService.sendSessionConfirmationTutor(
        full,
        session.idTutor,
      ),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS — CÁLCULOS Y MAPEOS
  // ═══════════════════════════════════════════════════════════════════════════

  private calcDuration(session: Session): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMin(session.endTime) - toMin(session.startTime)) / 60;
  }

  private mapToDetailedDto(session: Session): any {
    return {
      id: session.idSession,
      tutor: {
        id: session.tutor.idUser,
        name: session.tutor.user.name,
        photo: session.tutor.urlImage,
      },
      subject: { id: session.subject.idSubject, name: session.subject.name },
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: this.calcDuration(session),
      type: session.type,
      modality: session.modality,
      location: session.location,
      virtualLink: session.virtualLink,
      status: session.status,
      title: session.title,
      description: session.description,
      participants: session.studentParticipateSessions.map((p) => ({
        id: p.student.idUser,
        name: p.student.user.name,
        status: p.status,
      })),
      createdAt: session.createdAt,
      cancelledAt: session.cancelledAt,
      cancellationReason: session.cancellationReason,
    };
  }

  private mapToListDto(session: Session): any {
    return {
      id: session.idSession,
      title: session.title,
      description: session.description,
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: this.calcDuration(session),
      type: session.type,
      modality: session.modality,
      location: session.location,
      virtualLink: session.virtualLink,
      status: session.status,
      tutor: {
        id: session.tutor.idUser,
        name: session.tutor.user.name,
        photo: session.tutor.urlImage,
      },
      subject: { id: session.subject.idSubject, name: session.subject.name },
      participants:
        session.studentParticipateSessions?.map((p) => ({
          id: p.student.idUser,
          name: p.student.user.name,
          status: p.status,
        })) ?? [],
      createdAt: session.createdAt,
      cancelledAt: session.cancelledAt ?? null,
      cancellationReason: session.cancellationReason ?? null,
    };
  }

  private resolveStatusFilter(filter?: SessionStatusFilter): {
    statuses: SessionStatus[] | undefined;
    isNoShow: boolean;
  } {
    if (!filter) return { statuses: undefined, isNoShow: false };

    const map: Record<SessionStatusFilter, SessionStatus[]> = {
      [SessionStatusFilter.SCHEDULED]: [
        SessionStatus.SCHEDULED,
        SessionStatus.PENDING_MODIFICATION,
      ],
      [SessionStatusFilter.COMPLETED]: [SessionStatus.COMPLETED],
      [SessionStatusFilter.CANCELLED]: [
        SessionStatus.CANCELLED_BY_STUDENT,
        SessionStatus.CANCELLED_BY_TUTOR,
        SessionStatus.CANCELLED_BY_ADMIN,
      ],
      [SessionStatusFilter.NO_SHOW]: [SessionStatus.COMPLETED],
    };

    return {
      statuses: map[filter],
      isNoShow: filter === SessionStatusFilter.NO_SHOW,
    };
  }
}
