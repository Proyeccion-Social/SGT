// src/scheduling/services/session.service.ts

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
import { SessionFilterDto, SessionStatusFilter } from '../dto/session-filter.dto';

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
import { buildPaginatedResponse } from 'src/modules/common/helpers/pagination.helper';

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
  ) { }

  // ========================================
  // RF-19 / RF-20: CREAR SESIÓN INDIVIDUAL
  // ========================================

  async createIndividualSession(
    studentId: string,
    dto: CreateIndividualSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // --- Validaciones previas ---
      await this.validationService.validateStudentNotTutor(studentId, dto.tutorId);
      await this.tutorService.validateTutorActive(dto.tutorId);

      const availability = await this.availabilityService.getAvailabilityById(
        dto.availabilityId,
      );
      const startTime = availability.startTime;
      const endTime = this.validationService.calculateEndTime(startTime, dto.durationHours);

      await this.validationService.validateModality(
        dto.availabilityId,
        dto.tutorId,
        dto.modality,
      );

      // Solo rechazar si la franja ya tiene una sesión CONFIRMADA
      const existingScheduledSession = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoinAndSelect('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.idAvailability = :availabilityId', { availabilityId: dto.availabilityId })
        .andWhere('ss.scheduledDate = :scheduledDate', { scheduledDate: new Date(dto.scheduledDate) })
        .andWhere('session.status = :status', { status: SessionStatus.SCHEDULED })
        .setLock('pessimistic_write')
        .getOne();

      if (existingScheduledSession) {
        throw new BadRequestException(
          'Esta franja ya está ocupada para la fecha seleccionada. Por favor elige otro horario.',
        );
      }

      // Contar solicitudes pendientes para informar al estudiante
      const pendingCount = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.idAvailability = :availabilityId', { availabilityId: dto.availabilityId })
        .andWhere('ss.scheduledDate = :scheduledDate', { scheduledDate: new Date(dto.scheduledDate) })
        .andWhere('session.status = :status', { status: SessionStatus.PENDING_TUTOR_CONFIRMATION })
        .getCount();

      await this.validationService.validateNoTimeConflict(
        dto.tutorId,
        new Date(dto.scheduledDate),
        startTime,
        dto.durationHours,
      );

      await this.validationService.validateWeeklyHoursLimit(
        dto.tutorId,
        new Date(dto.scheduledDate),
        dto.durationHours,
      );

      // --- Crear sesión ---
      const session = queryRunner.manager.create(Session, {
        idTutor: dto.tutorId,
        idSubject: dto.subjectId,
        scheduledDate: new Date(dto.scheduledDate),
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

      const scheduledSession = queryRunner.manager.create(ScheduledSession, {
        idSession: savedSession.idSession,
        idTutor: dto.tutorId,
        idAvailability: dto.availabilityId,
        scheduledDate: new Date(dto.scheduledDate),
      });
      await queryRunner.manager.save(scheduledSession);

      const participation = queryRunner.manager.create(StudentParticipateSession, {
        idStudent: studentId,
        idSession: savedSession.idSession,
        status: ParticipationStatus.CONFIRMED,
      });
      await queryRunner.manager.save(participation);

      await queryRunner.commitTransaction();

      // --- Notificaciones (fuera de transacción) ---
      // RF-25: notificar al tutor (solicitud pendiente) y acusar recibo al estudiante
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

      if ((error as { code?: string }).code === '23505') {
        throw new BadRequestException(
          'Esta franja ya está ocupada. Por favor elige otro horario.',
        );
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // RF-20: CONFIRMAR SESIÓN (TUTOR)
  // ========================================

  async confirmSession(
    tutorId: string,
    sessionId: string,
    dto: ConfirmSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Bloquear y obtener la sesión
      const session = await queryRunner.manager
        .createQueryBuilder(Session, 'session')
        .where('session.idSession = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) throw new NotFoundException('Session not found');

      // 2. Validaciones
      if (session.idTutor !== tutorId) {
        throw new ForbiddenException('Solo el tutor asignado puede confirmar esta sesión');
      }
      if (session.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION) {
        throw new BadRequestException(
          `No se puede confirmar una sesión con estado ${session.status}`,
        );
      }

      // 3. Verificar que no haya otra sesión ya SCHEDULED en la misma franja
      const scheduledSession = await queryRunner.manager.findOne(ScheduledSession, {
        where: { idSession: sessionId },
      });
      if (!scheduledSession) throw new NotFoundException('ScheduledSession not found');

      const conflictingSession = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoin('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: scheduledSession.idAvailability,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: scheduledSession.scheduledDate,
        })
        .andWhere('session.status = :status', { status: SessionStatus.SCHEDULED })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (conflictingSession) {
        throw new BadRequestException(
          'Esta franja ya fue confirmada para otro estudiante.',
        );
      }

      // 4. Confirmar sesión
      session.status = SessionStatus.SCHEDULED;
      session.tutorConfirmed = true;
      session.tutorConfirmedAt = new Date();
      await queryRunner.manager.save(session);

      // 5. Auto-rechazar otras solicitudes pendientes en la misma franja
      const otherPendingSessions = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoinAndSelect('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: scheduledSession.idAvailability,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: scheduledSession.scheduledDate,
        })
        .andWhere('session.status = :status', { status: SessionStatus.PENDING_TUTOR_CONFIRMATION })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .getMany();

      const autoRejectedData: Array<{ session: Session; studentId: string }> = [];

      for (const otherScheduled of otherPendingSessions) {
        otherScheduled.session.status = SessionStatus.REJECTED_BY_TUTOR;
        otherScheduled.session.rejectionReason =
          'El tutor ya confirmó otra sesión para este horario';
        otherScheduled.session.rejectedAt = new Date();
        await queryRunner.manager.save(otherScheduled.session);

        const participation = await queryRunner.manager.findOne(
          StudentParticipateSession,
          { where: { idSession: otherScheduled.session.idSession }, select: ['idStudent'] },
        );

        if (participation?.idStudent) {
          autoRejectedData.push({
            session: otherScheduled.session,
            studentId: participation.idStudent,
          });
        }

        await queryRunner.manager.remove(otherScheduled);
      }

      // 6. Obtener el estudiante de la sesión confirmada
      const confirmedParticipation = await queryRunner.manager.findOne(
        StudentParticipateSession,
        { where: { idSession: sessionId }, select: ['idStudent'] },
      );
      if (!confirmedParticipation) {
        throw new NotFoundException('No se encontró el estudiante asociado a esta sesión');
      }
      const confirmedStudentId = confirmedParticipation.idStudent;

      await queryRunner.commitTransaction();

      // 7. Notificaciones (fuera de transacción)
      // RF-20: confirmación a estudiante y tutor
      await this.fireAndLogNotifications([
        this.sendConfirmationEmailsNotification(session, confirmedStudentId),
      ]);

      // RF-20: rechazo automático a los demás estudiantes
      //Cambio propuesto por copilot, originalmente:

      /*
      for (const { session: rejectedSession, studentId: rejectedStudentId } of autoRejectedData) {
        this.fireAndLogNotifications([
          this.notificationsService.sendSessionRejection(rejectedSession, rejectedStudentId),
        ]);
      }
      */

      const autoRejectNotificationPromises = autoRejectedData.map(
        ({ session: rejectedSession, studentId: rejectedStudentId }) =>
          this.notificationsService.sendSessionRejection(rejectedSession, rejectedStudentId),
      );
      await this.fireAndLogNotifications(autoRejectNotificationPromises);

      return {
        success: true,
        message: 'Sesión confirmada exitosamente',
        autoRejectedCount: otherPendingSessions.length,
        session: await this.getSessionById(sessionId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // RF-20: RECHAZAR SESIÓN (TUTOR)
  // ========================================

  async rejectSession(
    tutorId: string,
    sessionId: string,
    dto: RejectSessionDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'tutor', 'tutor.user', 'subject'],
    });
    if (!session) throw new NotFoundException('Session not found');

    if (session.idTutor !== tutorId) {
      throw new ForbiddenException('Solo el tutor asignado puede rechazar esta sesión');
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

    // Liberar franja
    await this.scheduledSessionRepository.delete({ idSession: sessionId });

    // RF-20: notificar al estudiante del rechazo
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

  // ========================================
  // RF-21: CANCELAR SESIÓN
  // ========================================

  async cancelSession(
    userId: string,
    sessionId: string,
    dto: CancelSessionDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'tutor', 'tutor.user', 'subject'],
    });
    if (!session) throw new NotFoundException('Session not found');

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;
    const isAdmin = await this.userService.isAdmin(userId);

    if (!isParticipant && !isTutor && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para cancelar esta sesión');
    }

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `No se puede cancelar una sesión con estado ${session.status}`,
      );
    }

    const isWithin24Hours = this.validationService.validateCancellationTime(
      session.scheduledDate,
      session.startTime,
    );

    if (!isWithin24Hours && !isAdmin) {
      throw new BadRequestException(
        'Solo puedes cancelar con al menos 24 horas de anticipación',
      );
    }

    let newStatus: SessionStatus;
    if (isParticipant) newStatus = SessionStatus.CANCELLED_BY_STUDENT;
    else if (isTutor) newStatus = SessionStatus.CANCELLED_BY_TUTOR;
    else newStatus = SessionStatus.CANCELLED_BY_ADMIN;

    session.status = newStatus;
    session.cancellationReason = dto.reason;
    session.cancelledAt = new Date();
    session.cancelledWithin24h = isWithin24Hours;
    session.cancelledBy = userId;
    await this.sessionRepository.save(session);

    // Liberar franja
    await this.scheduledSessionRepository.delete({ idSession: sessionId });

    // RF-21: notificar a ambas partes
    await this.fireAndLogNotifications([
      this.notificationsService.sendSessionCancellation(session, userId),
    ]);

    return {
      success: true,
      message: 'Sesión cancelada exitosamente',
    };
  }

  // ========================================
  // RF-22: PROPONER MODIFICACIÓN
  // (fecha, disponibilidad, modalidad, duración)
  // ========================================

  async proposeModification(
    userId: string,
    sessionId: string,
    dto: ProposeModificationDto,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'subject'],
    });
    if (!session) throw new NotFoundException('Session not found');

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException('No tienes permiso para modificar esta sesión');
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

    // Validar nueva disponibilidad si aplica
    if (dto.newScheduledDate || dto.newAvailabilityId || dto.newDurationHours) {
      const newDate = dto.newScheduledDate
        ? new Date(dto.newScheduledDate)
        : session.scheduledDate;

      let newStartTime = session.startTime;
      const newDuration =
        dto.newDurationHours ?? this.calculateDurationFromSession(session);

      if (dto.newAvailabilityId) {
        const newAvailability = await this.availabilityService.getAvailabilityById(
          dto.newAvailabilityId,
        );
        newStartTime = newAvailability.startTime;

        await this.validationService.validateAvailabilitySlot(
          session.idTutor,
          dto.newAvailabilityId,
          newDate,
        );

        const newModality = dto.newModality ?? session.modality;
        await this.validationService.validateModality(
          dto.newAvailabilityId,
          session.idTutor,
          newModality,
        );
      }

      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
      );

      await this.validationService.validateWeeklyHoursLimit(
        session.idTutor,
        newDate,
        newDuration,
        session.idSession,
      );
    }

    // Crear solicitud de modificación
    const expiresAt = addDays(new Date(), 1);

    const modificationRequest = new SessionModificationRequest();
    modificationRequest.idSession = sessionId;
    modificationRequest.requestedBy = userId;
    modificationRequest.newScheduledDate = dto.newScheduledDate
      ? new Date(dto.newScheduledDate)
      : undefined;
    modificationRequest.newAvailabilityId = dto.newAvailabilityId ?? undefined;
    modificationRequest.newModality = dto.newModality ?? undefined;
    modificationRequest.newDurationHours = dto.newDurationHours ?? undefined;
    modificationRequest.status = ModificationStatus.PENDING;
    modificationRequest.expiresAt = expiresAt;

    const savedRequest = await this.modificationRequestRepository.save(modificationRequest);

    // Pasar sesión a PENDING_MODIFICATION
    session.status = SessionStatus.PENDING_MODIFICATION;
    await this.sessionRepository.save(session);

    // RF-22: notificar a la contraparte sobre la propuesta
    await this.fireAndLogNotifications([
      this.notificationsService.sendModificationRequest(session, userId, savedRequest),
    ]);

    return {
      success: true,
      message: 'Modificación propuesta exitosamente',
      requestId: savedRequest.idRequest,
      expiresAt,
    };
  }

  // ========================================
  // RF-22: RESPONDER A PROPUESTA DE MODIFICACIÓN
  // ========================================

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
      });
      if (!session) throw new NotFoundException('Session not found');

      const pendingRequest = await queryRunner.manager.findOne(
        SessionModificationRequest,
        { where: { idSession: sessionId, status: ModificationStatus.PENDING } },
      );
      if (!pendingRequest) throw new NotFoundException('No pending modification request');

      const participations = await queryRunner.manager.find(StudentParticipateSession, {
        where: { idSession: sessionId },
        select: ['idStudent'],
      });

      const isParticipant = participations.some((p) => p.idStudent === userId);
      const isTutor = session.idTutor === userId;

      if (!isParticipant && !isTutor) {
        throw new ForbiddenException('No tienes permiso para responder');
      }
      if (pendingRequest.requestedBy === userId) {
        throw new BadRequestException('No puedes responder tu propia solicitud');
      }

      // Verificar expiración
      if (new Date() > pendingRequest.expiresAt) {
        pendingRequest.status = ModificationStatus.EXPIRED;
        await queryRunner.manager.save(pendingRequest);
        session.status = SessionStatus.SCHEDULED;
        await queryRunner.manager.save(session);
        throw new BadRequestException('La solicitud ha expirado');
      }

      // --- RECHAZAR ---
      if (!accept) {
        session.status = SessionStatus.SCHEDULED;
        pendingRequest.status = ModificationStatus.REJECTED;
        pendingRequest.respondedBy = userId;
        pendingRequest.respondedAt = new Date();

        await queryRunner.manager.save(session);
        await queryRunner.manager.save(pendingRequest);
        await queryRunner.commitTransaction();

        // RF-22: notificar al solicitante que fue rechazada
        await this.fireAndLogNotifications([
          this.notificationsService.sendModificationResponse(session, pendingRequest, false),
        ]);

        return { success: true, message: 'Modificación rechazada' };
      }

      // --- ACEPTAR ---
      const newDuration =
        pendingRequest.newDurationHours ?? this.calculateDurationFromSession(session);
      const newDate = pendingRequest.newScheduledDate ?? session.scheduledDate;

      const scheduledSession = await queryRunner.manager.findOne(ScheduledSession, {
        where: { idSession: sessionId },
      });
      if (!scheduledSession) throw new NotFoundException('ScheduledSession not found');

      let newStartTime = session.startTime;

      if (pendingRequest.newAvailabilityId) {
        const newAvailability = await this.availabilityService.getAvailabilityById(
          pendingRequest.newAvailabilityId,
        );
        newStartTime = newAvailability.startTime;
        scheduledSession.idAvailability = pendingRequest.newAvailabilityId;
      }

      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
        session.idSession,
      );

      // Aplicar cambios
      session.scheduledDate = newDate;
      scheduledSession.scheduledDate = newDate;
      session.startTime = newStartTime;
      session.endTime = this.validationService.calculateEndTime(newStartTime, newDuration);
      if (pendingRequest.newModality) session.modality = pendingRequest.newModality;
      session.status = SessionStatus.SCHEDULED;

      await queryRunner.manager.save(scheduledSession);
      await queryRunner.manager.save(session);

      pendingRequest.status = ModificationStatus.ACCEPTED;
      pendingRequest.respondedBy = userId;
      pendingRequest.respondedAt = new Date();
      await queryRunner.manager.save(pendingRequest);

      await queryRunner.commitTransaction();

      // RF-22: notificar al solicitante que fue aceptada
      await this.fireAndLogNotifications([
        this.notificationsService.sendModificationResponse(session, pendingRequest, true),
      ]);

      return { success: true, message: 'Modificación aceptada exitosamente' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // RF-22: ACTUALIZAR DETALLES (sin aprobación)
  // título, descripción, virtualLink, location
  // ========================================

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

    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException('No tienes permiso para modificar esta sesión');
    }

    // No se puede editar si la sesión ya comenzó
    const sessionDateTime = new Date(session.scheduledDate);
    const [hours, minutes] = session.startTime.split(':').map(Number);
    sessionDateTime.setHours(hours, minutes, 0, 0);

    if (new Date() >= sessionDateTime) {
      throw new BadRequestException(
        'No puedes modificar una sesión que ya ha iniciado',
      );
    }

    // Aplicar cambios directamente sin propuesta
    if (dto.title) session.title = dto.title;
    if (dto.description) session.description = dto.description;
    if (dto.location) session.location = dto.location;
    if (dto.virtualLink) session.virtualLink = dto.virtualLink;

    await this.sessionRepository.save(session);

    // RF-22: notificar a ambas partes (sin necesidad de aprobación)
    await this.fireAndLogNotifications([
      this.notificationsService.sendSessionDetailsUpdate(session),
    ]);

    return {
      success: true,
      message: 'Detalles de la sesión actualizados exitosamente',
    };
  }

  // ========================================
  // CONSULTAS
  // ========================================

  async getModificationRequestById(requestId: string) {
    const request = await this.modificationRequestRepository.findOne({
      where: { idRequest: requestId },
    });
    if (!request) throw new NotFoundException('Modification request not found');
    return request;
  }

  async getModificationRequestBySessionId(sessionId:string){
    const request = await this.modificationRequestRepository.findOne({
      where: { idSession: sessionId },
    });
    if (!request) throw new NotFoundException('Modification request not found');
    return request;
  }



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

  async getMySessionsAsStudent(
  studentId: string,
  filters: SessionFilterDto,
) {
  const { page=1, limit=10 } = filters;
  const offset = (page - 1) * limit;
  const { statuses, isNoShow } = this.resolveStatusFilter(filters.status);

  const qb = this.studentParticipateRepository
    .createQueryBuilder('participation')
    .innerJoinAndSelect('participation.session', 'session')
    .innerJoinAndSelect('session.tutor', 'tutor')
    .innerJoinAndSelect('tutor.user', 'tutorUser')
    .innerJoinAndSelect('session.subject', 'subject')
    .leftJoinAndSelect('session.studentParticipateSessions', 'allParticipations')
    .leftJoinAndSelect('allParticipations.student', 'student')
    .leftJoinAndSelect('student.user', 'studentUser')
    .where('participation.idStudent = :studentId', { studentId })
    .orderBy('session.scheduledDate', 'DESC')
    .addOrderBy('session.startTime', 'DESC');

  if (statuses) {
    qb.andWhere('session.status IN (:...statuses)', { statuses });
  }

  // Condición adicional para NO_SHOW:
  // La participación de este estudiante específico debe ser ABSENT
  if (isNoShow) {
    qb.andWhere('participation.status = :absentStatus', {
      absentStatus: ParticipationStatus.ABSENT,
    });
  }

  const [participations, total] = await qb
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  const items = participations.map((p) => this.mapToListDto(p.session));

  return buildPaginatedResponse(items, total, page, limit);
}

  async getMySessionsAsTutor(tutorId: string, filters: SessionFilterDto) {
  const { page = 1, limit = 10, status } = filters;
  const offset = (page - 1) * limit;
  
  // CORRECCIÓN: Extrae las propiedades como en el método del Student
  const { statuses, isNoShow } = this.resolveStatusFilter(status);


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

  //  Ahora statuses es un array, no un objeto
  if (statuses && statuses.length > 0) {
    qb.andWhere('session.status IN (:...statuses)', { statuses });
  }

  // Si se necesita manejar el caso NO_SHOW para tutor
  //if (isNoShow) {
    
  //}

  const [sessions, total] = await qb.skip(offset).take(limit).getManyAndCount();
  const items = sessions.map((s) => this.mapToListDto(s));
  return this.buildPaginatedResponse(items, total, page, limit);
}

  // ========================================
  // HELPERS PRIVADOS — NOTIFICACIONES
  // ========================================

  /**
   * Envuelve las llamadas de notificación para que un fallo de email
   * nunca interrumpa el flujo de negocio, pero siempre quede registrado en el log.
   */
  private async fireAndLogNotifications(promises: Promise<void>[]): Promise<void> {
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'rejected') {
        // El Logger de NotificationsService ya registra el detalle;
        // aquí solo anotamos que hubo un fallo para visibilidad en SessionService.
        console.error('[SessionService] Fallo al enviar notificación:', result.reason);
      }
    }
  }

  /**
   * RF-25: Obtiene la sesión completa y notifica al tutor sobre la nueva solicitud.
   */
  private async sendTutorConfirmationRequestNotification(
    session: Session,
    studentId: string,
  ): Promise<void> {
    const fullSession = await this.getSessionById(session.idSession);
    await this.notificationsService.sendTutorConfirmationRequest(fullSession, studentId);
  }

  /**
   * RF-25: Obtiene la sesión completa y envía acuse de recibo al estudiante.
   */
  private async sendStudentRequestAckNotification(
    session: Session,
    studentId: string,
  ): Promise<void> {
    const fullSession = await this.getSessionById(session.idSession);
    await this.notificationsService.sendStudentSessionRequestAck(fullSession, studentId);
  }

  /**
   * RF-20: Notifica al estudiante y al tutor que la sesión fue confirmada.
   */
  private async sendConfirmationEmailsNotification(
    session: Session,
    confirmedStudentId: string,
  ): Promise<void> {
    const fullSession = await this.getSessionById(session.idSession);
    await Promise.all([
      this.notificationsService.sendSessionConfirmationStudent(fullSession, confirmedStudentId),
      this.notificationsService.sendSessionConfirmationTutor(fullSession, session.idTutor),
    ]);
  }

  // ========================================
  // HELPERS PRIVADOS — CÁLCULOS Y MAPEOS
  // ========================================

  private calculateDurationFromSession(session: Session): number {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMinutes(session.endTime) - toMinutes(session.startTime)) / 60;
  }

  private mapToDetailedDto(session: Session): any {
    return {
      id: session.idSession,
      tutor: {
        id: session.tutor.idUser,
        name: session.tutor.user.name,
        photo: session.tutor.urlImage,
      },
      subject: {
        id: session.subject.idSubject,
        name: session.subject.name,
      },
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: this.calculateDurationFromSession(session),
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
      duration: this.calculateDurationFromSession(session),
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
      subject: {
        id: session.subject.idSubject,
        name: session.subject.name,
      },
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
    isNoShow: boolean; // Se añade para manejar el caso especial de NO_SHOW
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
      [SessionStatusFilter.NO_SHOW]: [SessionStatus.COMPLETED], // mismo estado base
    };

    return {
      statuses: map[filter],
      isNoShow: filter === SessionStatusFilter.NO_SHOW,
    };
  }

  private buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
}
