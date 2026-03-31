// src/scheduling/services/session.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { ScheduledSession } from '../entities/scheduled-session.entity';
import { StudentParticipateSession } from '../entities/student-participate-session.entity';
import { SessionModificationRequest } from '../entities/session-modification-request.entity';
import { CreateIndividualSessionDto } from '../dto/create-individual-session.dto';
import { CancelSessionDto } from '../dto/cancel-session.dto';
import { ProposeModificationDto } from '../dto/propose-modification.dto';
import { UpdateSessionDetailsDto } from '../dto/update-session-details.dto';
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
import { addHours } from 'date-fns';
import { ExternalConfigService } from '../../external-config/services/external-config.service';
import { ConfirmSessionDto } from '../dto/confirm-session.dto';
import { RejectSessionDto } from '../dto/reject-session.dto';
import { SessionFilterDto, SessionStatusFilter } from '../dto/session-filter.dto';

@Injectable()
export class SessionService {
  constructor(
    // Solo repositorios del dominio Scheduling
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

    // Servicios de otros módulos
    private readonly validationService: SessionValidationService,
    private readonly availabilityService: AvailabilityService,
    private readonly tutorService: TutorService,
    private readonly userService: UserService,
    private readonly subjectsService: SubjectsService,
    private readonly notificationsService: NotificationsService,
    private readonly externalConfigService: ExternalConfigService,

  ) { }

  // ========================================
  // RF-19, RF-20: CREAR SESIÓN INDIVIDUAL
  // ========================================

  async createIndividualSession(
    studentId: string,
    dto: CreateIndividualSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ========================================
      // VALIDACIONES PREVIAS (sin cambios)
      // ========================================

      await this.validationService.validateStudentNotTutor(studentId, dto.tutorId);
      await this.tutorService.validateTutorActive(dto.tutorId);

      const allowedDurations = this.externalConfigService.getConfig().scheduling.allowed_duration_hours;
      if (!allowedDurations.includes(dto.durationHours)) {
        throw new BadRequestException(
          `durationHours debe ser uno de: ${allowedDurations.join(', ')}`,
        );
      }

      const availability = await this.availabilityService.getAvailabilityById(
        dto.availabilityId,
      );

      const startTime = availability.startTime;
      const endTime = this.validationService.calculateEndTime(
        startTime,
        dto.durationHours,
      );

      await this.validationService.validateModality(
        dto.availabilityId,
        dto.tutorId,
        dto.modality,
      );

      // ========================================
      //  VALIDACIÓN CRÍTICA: Solo rechazar si hay sesión CONFIRMADA
      // ========================================

      const existingScheduledSession = await queryRunner.manager
        .createQueryBuilder(ScheduledSession, 'ss')
        .innerJoinAndSelect('ss.session', 'session')
        .where('ss.idTutor = :tutorId', { tutorId: dto.tutorId })
        .andWhere('ss.idAvailability = :availabilityId', {
          availabilityId: dto.availabilityId,
        })
        .andWhere('ss.scheduledDate = :scheduledDate', {
          scheduledDate: new Date(dto.scheduledDate),
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.SCHEDULED, //  Solo si está CONFIRMADA
        })
        .setLock('pessimistic_write')
        .getOne();

      if (existingScheduledSession) {
        throw new BadRequestException(
          'Esta franja ya está ocupada para la fecha seleccionada. Por favor elige otro horario.',
        );
      }

      //  OPCIONAL: Informar al estudiante si hay solicitudes pendientes
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

      // Validaciones de conflicto de horario y límite semanal
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

      // ========================================
      // CREAR SESIÓN
      // ========================================

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

      const participation = queryRunner.manager.create(
        StudentParticipateSession,
        {
          idStudent: studentId,
          idSession: savedSession.idSession,
          status: ParticipationStatus.CONFIRMED,
        },
      );

      await queryRunner.manager.save(participation);

      await queryRunner.commitTransaction();

      // ========================================
      // NOTIFICAR
      // ========================================

      await this.sendTutorConfirmationRequest(savedSession, studentId);

      return {
        success: true,
        message:
          pendingCount > 0
            ? `Solicitud enviada. Hay ${pendingCount} solicitud(es) pendiente(s) para este horario. El tutor elegirá una.`
            : 'Solicitud de sesión enviada al tutor. Recibirás una notificación cuando el tutor confirme.',
        session: await this.getSessionById(savedSession.idSession),
        pendingRequestsCount: pendingCount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

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


  // ========================================
  // RF-20: CONFIRMAR SESIÓN (TUTOR)
  // ========================================

  // src/scheduling/services/session.service.ts

  async confirmSession(
    tutorId: string,
    sessionId: string,
    dto: ConfirmSessionDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ========================================
      // 1. BLOQUEAR Session
      // ========================================

      const session = await queryRunner.manager
        .createQueryBuilder(Session, 'session')
        .where('session.idSession = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // ========================================
      // 2. VALIDACIONES
      // ========================================

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

      // ========================================
      // 3. VALIDAR que no haya otra sesión SCHEDULED
      // ========================================

      const scheduledSession = await queryRunner.manager.findOne(
        ScheduledSession,
        {
          where: { idSession: sessionId },
        },
      );

      if (!scheduledSession) {
        throw new NotFoundException('ScheduledSession not found');
      }

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
        .andWhere('session.status = :status', {
          status: SessionStatus.SCHEDULED,
        })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (conflictingSession) {
        throw new BadRequestException(
          'Esta franja ya fue confirmada para otro estudiante. No puedes confirmar esta solicitud.',
        );
      }

      // ========================================
      // 4. CONFIRMAR SESIÓN
      // ========================================

      session.status = SessionStatus.SCHEDULED;
      session.tutorConfirmed = true;
      session.tutorConfirmedAt = new Date();

      await queryRunner.manager.save(session);

      // ========================================
      // 5. AUTO-RECHAZAR OTRAS SOLICITUDES PENDIENTES
      // ========================================

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
        .andWhere('session.status = :status', {
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        })
        .andWhere('ss.idSession != :sessionId', { sessionId })
        .getMany();

      // Array para guardar IDs de estudiantes rechazados
      const rejectedStudentIds: string[] = [];

      for (const otherScheduled of otherPendingSessions) {
        otherScheduled.session.status = SessionStatus.REJECTED_BY_TUTOR;
        otherScheduled.session.rejectionReason =
          'El tutor ya confirmó otra sesión para este horario';
        otherScheduled.session.rejectedAt = new Date();

        await queryRunner.manager.save(otherScheduled.session);

        // OBTENER ID del estudiante ANTES de eliminar ScheduledSession
        const participation = await queryRunner.manager.findOne(
          StudentParticipateSession,
          {
            where: { idSession: otherScheduled.session.idSession },
            select: ['idStudent'],
          },
        );

        if (participation?.idStudent) {
          rejectedStudentIds.push(participation.idStudent);
        }

        // Eliminar ScheduledSession
        await queryRunner.manager.remove(otherScheduled);
      }

      // ========================================
      // 6. OBTENER ID del estudiante CONFIRMADO
      // ========================================

      // CARGAR participation de la sesión confirmada
      const confirmedParticipation = await queryRunner.manager.findOne(
        StudentParticipateSession,
        {
          where: { idSession: sessionId },
          select: ['idStudent'],
        },
      );

      if (!confirmedParticipation) {
        throw new NotFoundException(
          'No se encontró el estudiante asociado a esta sesión',
        );
      }

      const confirmedStudentId = confirmedParticipation.idStudent;

      // ========================================
      // 7. COMMIT
      // ========================================

      await queryRunner.commitTransaction();

      // ========================================
      // 8. NOTIFICACIONES (fuera de transacción)
      // ========================================

      // Notificar confirmación
      await this.sendConfirmationEmails(session, confirmedStudentId);

      // Notificar rechazos automáticos
      for (let i = 0; i < otherPendingSessions.length; i++) {
        const rejectedSession = otherPendingSessions[i].session;
        const rejectedStudentId = rejectedStudentIds[i];

        if (rejectedStudentId) {
          this.sendSessionRejectionEmail(rejectedSession, rejectedStudentId).catch(
            (error) => {
              console.error('Error sending auto-rejection email:', error);
            },
          );
        }
      }

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
    // 1. Buscar sesión
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'tutor', 'tutor.user', 'subject'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Validar que el usuario sea el tutor asignado
    if (session.idTutor !== tutorId) {
      throw new ForbiddenException(
        'Solo el tutor asignado puede rechazar esta sesión',
      );
    }

    // 3. Validar que la sesión esté en estado PENDING_TUTOR_CONFIRMATION
    if (session.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION) {
      throw new BadRequestException(
        `No se puede rechazar una sesión con estado ${session.status}`,
      );
    }

    // 4. Actualizar estado de la sesión
    session.status = SessionStatus.REJECTED_BY_TUTOR;
    session.rejectionReason = dto.reason;
    session.rejectedAt = new Date();

    await this.sessionRepository.save(session);

    // 5. Liberar franja
    await this.scheduledSessionRepository.delete({
      idSession: sessionId,
    });

    // 6. Notificar al estudiante del rechazo
    const studentId = session.studentParticipateSessions[0]?.idStudent;
    if (studentId) {
      await this.sendSessionRejectionEmail(session, studentId);
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
    // 1. Buscar sesión con relaciones
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions', 'tutor', 'tutor.user', 'subject'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Validar que el usuario sea participante, tutor o admin
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

    // 3. Validar que la sesión esté en estado SCHEDULED
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `No se puede cancelar una sesión con estado ${session.status}`,
      );
    }

    // 4. Validar 24h de anticipación (excepto admin)
    const isWithin24Hours = this.validationService.validateCancellationTime(
      session.scheduledDate,
      session.startTime,
    );

    if (!isWithin24Hours && !isAdmin) {
      throw new BadRequestException(
        'Solo puedes cancelar con al menos 24 horas de anticipación',
      );
    }

    // 5. Actualizar estado de la sesión
    let newStatus: SessionStatus;

    if (isParticipant) {
      newStatus = SessionStatus.CANCELLED_BY_STUDENT;
    } else if (isTutor) {
      newStatus = SessionStatus.CANCELLED_BY_TUTOR;
    } else {
      newStatus = SessionStatus.CANCELLED_BY_ADMIN;
    }

    session.status = newStatus;
    session.cancellationReason = dto.reason;
    session.cancelledAt = new Date();
    session.cancelledWithin24h = isWithin24Hours;
    session.cancelledBy = userId;

    await this.sessionRepository.save(session);

    // 6. Liberar franja (HU-21.1.3)
    await this.scheduledSessionRepository.delete({
      idSession: sessionId,
    });

    // 7. Notificar cancelación
    await this.sendCancellationEmail(session, userId);

    return {
      success: true,
      message: 'Sesión cancelada exitosamente',
    };
  }

  // ========================================
  // RF-22: PROPONER MODIFICACIÓN
  // ========================================

  async proposeModification(
    userId: string,
    sessionId: string,
    dto: ProposeModificationDto,
  ) {
    // 1. Buscar sesión
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Validar que el usuario sea participante o tutor
    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta sesión',
      );
    }

    // 3. Validar que la sesión esté SCHEDULED
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Solo puedes modificar sesiones en estado SCHEDULED',
      );
    }

    // 4. Validar que se esté proponiendo al menos un cambio
    if (
      !dto.newScheduledDate &&
      !dto.newAvailabilityId &&
      !dto.newModality &&
      !dto.newDurationHours
    ) {
      throw new BadRequestException(
        'Debes proponer al menos un cambio',
      );
    }

    // 5. Si se propone nueva fecha/hora, validar disponibilidad y límite semanal
    if (dto.newScheduledDate || dto.newAvailabilityId || dto.newDurationHours) {
      const newDate = dto.newScheduledDate
        ? new Date(dto.newScheduledDate)
        : session.scheduledDate;

      let newStartTime = session.startTime;
      let newDuration = dto.newDurationHours || this.calculateDurationFromSession(session);

      if (dto.newAvailabilityId) {
        const newAvailability = await this.availabilityService.getAvailabilityById(
          dto.newAvailabilityId,
        );
        newStartTime = newAvailability.startTime;

        // Validar franja disponible
        await this.validationService.validateAvailabilitySlot(
          session.idTutor,
          dto.newAvailabilityId,
          newDate,
        );

        // Validar modalidad si se propone cambio
        const newModality = dto.newModality || session.modality;
        await this.validationService.validateModality(
          dto.newAvailabilityId,
          session.idTutor,
          newModality,
        );
      }

      // Validar no conflicto
      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
      );

      // Validar límite semanal (HU-22.1.2, HU-22.2.2)
      await this.validationService.validateWeeklyHoursLimit(
        session.idTutor,
        newDate,
        newDuration,
        session.idSession, // Excluir sesión actual
      );
    }

    // 6. Crear solicitud de modificación
    const { modification_expiry_hours } = this.externalConfigService.getConfig().scheduling;
    const expiresAt = addHours(new Date(), modification_expiry_hours);

    //  Usar constructor en lugar de .create()
    const modificationRequest = new SessionModificationRequest();
    modificationRequest.idSession = sessionId;
    modificationRequest.requestedBy = userId;
    modificationRequest.newScheduledDate = dto.newScheduledDate
      ? new Date(dto.newScheduledDate)
      : undefined;
    modificationRequest.newAvailabilityId = dto.newAvailabilityId || undefined;
    modificationRequest.newModality = dto.newModality || undefined;
    modificationRequest.newDurationHours = dto.newDurationHours || undefined;
    modificationRequest.status = ModificationStatus.PENDING;
    modificationRequest.expiresAt = expiresAt;

    const savedRequest = await this.modificationRequestRepository.save(
      modificationRequest,
    );

    await this.modificationRequestRepository.save(modificationRequest);

    // 7. Cambiar estado de sesión a PENDING_MODIFICATION (HU-22.1.1, HU-22.2.1)
    session.status = SessionStatus.PENDING_MODIFICATION;
    await this.sessionRepository.save(session);

    // 8. Notificar a la otra parte
    await this.sendModificationRequestEmail(session, userId, modificationRequest);

    return {
      success: true,
      message: 'Modificación propuesta exitosamente',
      requestId: modificationRequest.idRequest,
      expiresAt,
    };
  }

  // ========================================
  // RF-22: RESPONDER A MODIFICACIÓN
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
      // ========================================
      // 1. Obtener sesión
      // ========================================
      const session = await queryRunner.manager.findOne(Session, {
        where: { idSession: sessionId },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // ========================================
      // 2. Obtener request pendiente
      // ========================================
      const pendingRequest = await queryRunner.manager.findOne(
        SessionModificationRequest,
        {
          where: {
            idSession: sessionId,
            status: ModificationStatus.PENDING,
          },
        },
      );

      if (!pendingRequest) {
        throw new NotFoundException('No pending modification request');
      }

      // ========================================
      // 3. Validar permisos
      // ========================================
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
        throw new BadRequestException('No puedes responder tu propia solicitud');
      }

      // ========================================
      // 4. Validar expiración
      // ========================================
      if (new Date() > pendingRequest.expiresAt) {
        pendingRequest.status = ModificationStatus.EXPIRED;
        await queryRunner.manager.save(pendingRequest);

        session.status = SessionStatus.SCHEDULED;
        await queryRunner.manager.save(session);

        throw new BadRequestException('La solicitud ha expirado');
      }

      // ========================================
      // 5. RECHAZAR
      // ========================================
      if (!accept) {
        session.status = SessionStatus.SCHEDULED;
        pendingRequest.status = ModificationStatus.REJECTED;
        pendingRequest.respondedBy = userId;
        pendingRequest.respondedAt = new Date();

        await queryRunner.manager.save(session);
        await queryRunner.manager.save(pendingRequest);

        await queryRunner.commitTransaction();

        await this.sendModificationResponseEmail(session, pendingRequest, false);

        return {
          success: true,
          message: 'Modificación rechazada',
        };
      }

      // ========================================
      // 6. ACEPTAR - Calcular valores nuevos
      // ========================================

      // Duración (ANTES de cambiar startTime)
      const newDuration =
        pendingRequest.newDurationHours ??
        this.calculateDurationFromSession(session);

      // Fecha
      const newDate = pendingRequest.newScheduledDate ?? session.scheduledDate;

      // Obtener ScheduledSession
      const scheduledSession = await queryRunner.manager.findOne(
        ScheduledSession,
        { where: { idSession: sessionId } },
      );

      if (!scheduledSession) {
        throw new NotFoundException('ScheduledSession not found');
      }

      // Determinar nuevo startTime
      let newStartTime = session.startTime;

      if (pendingRequest.newAvailabilityId) {
        const newAvailability =
          await this.availabilityService.getAvailabilityById(
            pendingRequest.newAvailabilityId,
          );

        newStartTime = newAvailability.startTime;
        scheduledSession.idAvailability = pendingRequest.newAvailabilityId;
      }

      // ========================================
      // 7. VALIDAR conflicto de horario
      // ========================================
      await this.validationService.validateNoTimeConflict(
        session.idTutor,
        newDate,
        newStartTime,
        newDuration,
        session.idSession, // Excluir la misma sesión
      );

      // ========================================
      // 8. APLICAR cambios
      // ========================================

      // Fecha
      session.scheduledDate = newDate;
      scheduledSession.scheduledDate = newDate;

      // Horario
      session.startTime = newStartTime;
      session.endTime = this.validationService.calculateEndTime(
        newStartTime,
        newDuration,
      );

      // Modalidad
      if (pendingRequest.newModality) {
        session.modality = pendingRequest.newModality;
      }

      // Estado
      session.status = SessionStatus.SCHEDULED;

      // ========================================
      // 9. GUARDAR cambios
      // ========================================
      await queryRunner.manager.save(scheduledSession);
      await queryRunner.manager.save(session);

      // Actualizar request
      pendingRequest.status = ModificationStatus.ACCEPTED;
      pendingRequest.respondedBy = userId;
      pendingRequest.respondedAt = new Date();
      await queryRunner.manager.save(pendingRequest);

      await queryRunner.commitTransaction();

      // ========================================
      // 10. NOTIFICAR (fuera de transacción)
      // ========================================
      await this.sendModificationResponseEmail(session, pendingRequest, true);

      return {
        success: true,
        message: 'Modificación aceptada exitosamente',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================
  // RF-22: MODIFICAR TÍTULO/DESCRIPCIÓN
  // ========================================

  async updateSessionDetails(
    userId: string,
    sessionId: string,
    dto: UpdateSessionDetailsDto,
  ) {
    // 1. Buscar sesión
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
      relations: ['studentParticipateSessions'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Validar que el usuario sea participante o tutor
    const isParticipant = session.studentParticipateSessions.some(
      (p) => p.idStudent === userId,
    );
    const isTutor = session.idTutor === userId;

    if (!isParticipant && !isTutor) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta sesión',
      );
    }

    // 3. Validar que la sesión no haya iniciado (HU-22.4.2)
    const now = new Date();
    const sessionDateTime = new Date(session.scheduledDate);
    const [hours, minutes] = session.startTime.split(':').map(Number);
    sessionDateTime.setHours(hours, minutes, 0, 0);

    if (now >= sessionDateTime) {
      throw new BadRequestException(
        'No puedes modificar una sesión que ya ha iniciado',
      );
    }

    // 4. Actualizar campos (HU-22.4.1)
    if (dto.title) {
      session.title = dto.title;
    }

    if (dto.description) {
      session.description = dto.description;
    }

    //nuevos campos

    if(dto.location){
      session.location = dto.location;
    }
    if(dto.virtualLink){
      session.virtualLink = dto.virtualLink;
    }

    await this.sessionRepository.save(session);

    // 5. Notificar cambios (HU-22.4.3)
    await this.sendSessionDetailsUpdateEmail(session);

    return {
      success: true,
      message: 'Detalles de la sesión actualizados exitosamente',
    };
  }

  // ========================================
  // CONSULTAS
  // ========================================

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

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return this.mapToDetailedDto(session);
  }

  async getMySessionsAsStudent(
  studentId: string,
  filters: SessionFilterDto,
) {
  const { page=1, limit=10, status } = filters;
  const offset = (page - 1) * limit;
  const statuses = this.resolveStatusFilter(status);

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

  const [participations, total] = await qb
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  const items = participations.map((p) =>
    this.mapToListDto(p.session),
  );

  return this.buildPaginatedResponse(items, total, page, limit);
}

async getMySessionsAsTutor(
  tutorId: string,
  filters: SessionFilterDto,
) {
  const { page =1, limit=10, status } = filters;
  const offset = (page - 1) * limit;
  const statuses = this.resolveStatusFilter(status);

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

  if (statuses) {
    qb.andWhere('session.status IN (:...statuses)', { statuses });
  }

  const [sessions, total] = await qb
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  const items = sessions.map((s) => this.mapToListDto(s));

  return this.buildPaginatedResponse(items, total, page, limit);
}

  // ========================================
  // MÉTODOS PRIVADOS - NOTIFICACIONES
  // ========================================

  private async sendConfirmationEmails(session: Session, studentId: string) {
    try {
      // Obtener datos completos
      const fullSession = await this.getSessionById(session.idSession);

      // Email al estudiante (HU-20.2.1, HU-20.2.2)
      await this.notificationsService.sendSessionConfirmationStudent(
        fullSession,
        studentId,
      );

      // Email al tutor (HU-20.3.1, HU-20.3.2)
      await this.notificationsService.sendSessionConfirmationTutor(
        fullSession,
        session.idTutor,
      );
    } catch (error) {
      console.error('Error sending confirmation emails:', error);
      // No romper el flujo si falla el email
    }
  }

  private async sendCancellationEmail(session: Session, cancelledBy: string) {
    try {
      await this.notificationsService.sendSessionCancellation(
        session,
        cancelledBy,
      );
    } catch (error) {
      console.error('Error sending cancellation email:', error);
    }
  }

  private async sendModificationRequestEmail(
    session: Session,
    requestedBy: string,
    request: SessionModificationRequest,
  ) {
    try {
      await this.notificationsService.sendModificationRequest(
        session,
        requestedBy,
        request,
      );
    } catch (error) {
      console.error('Error sending modification request email:', error);
    }
  }

  private async sendModificationResponseEmail(
    session: Session,
    request: SessionModificationRequest,
    accepted: boolean,
  ) {
    try {
      await this.notificationsService.sendModificationResponse(
        session,
        request,
        accepted,
      );
    } catch (error) {
      console.error('Error sending modification response email:', error);
    }
  }

  private async sendSessionDetailsUpdateEmail(session: Session) {
    try {
      await this.notificationsService.sendSessionDetailsUpdate(session);
    } catch (error) {
      console.error('Error sending details update email:', error);
    }
  }

  /**
   * Enviar solicitud de confirmación al tutor
   */
  private async sendTutorConfirmationRequest(
    session: Session,
    studentId: string,
  ) {
    try {
      const fullSession = await this.getSessionById(session.idSession);

      await this.notificationsService.sendTutorConfirmationRequest(
        fullSession,
        studentId,
      );
    } catch (error) {
      console.error('Error sending tutor confirmation request:', error);
      // No romper el flujo si falla el email
    }
  }

  /**
   * Enviar notificación de rechazo al estudiante
   */
  private async sendSessionRejectionEmail(
    session: Session,
    studentId: string,
  ) {
    try {
      await this.notificationsService.sendSessionRejection(
        session,
        studentId,
      );
    } catch (error) {
      console.error('Error sending rejection email:', error);
    }
  }

  // ========================================
  // HELPERS PRIVADOS
  // ========================================

  private calculateDurationFromSession(session: Session): number {
    const startMinutes = this.timeToMinutes(session.startTime);
    const endMinutes = this.timeToMinutes(session.endTime);
    return (endMinutes - startMinutes) / 60;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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

      location: session.location, //nuevo
      virtualLink: session.virtualLink, //nuevo

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

    location: session.location, //nuevo
    virtualLink: session.virtualLink, //nuevo

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
    participants: session.studentParticipateSessions?.map((p) => ({
      id: p.student.idUser,
      name: p.student.user.name,
      status: p.status,
    })) ?? [],
    createdAt: session.createdAt,
    cancelledAt: session.cancelledAt ?? null,
    cancellationReason: session.cancellationReason ?? null,
  };
}

  

  // Mapea el filtro simplificado del front a los estados internos correspondientes
private resolveStatusFilter(filter?: SessionStatusFilter): SessionStatus[] | undefined {
  if (!filter) return undefined;

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
  };

  return map[filter];
}

// Envuelve cualquier lista en la estructura de paginación estándar
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