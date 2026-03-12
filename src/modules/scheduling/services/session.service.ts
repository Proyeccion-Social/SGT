// src/scheduling/services/session.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { addDays } from 'date-fns';
import { ConfirmSessionDto } from '../dto/confirm-session.dto';
import { RejectSessionDto } from '../dto/reject-session.dto';

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

    // Servicios de otros módulos
    private readonly validationService: SessionValidationService,
    private readonly availabilityService: AvailabilityService,
    private readonly tutorService: TutorService,
    private readonly userService: UserService,
    private readonly subjectsService: SubjectsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ========================================
  // RF-19, RF-20: CREAR SESIÓN INDIVIDUAL
  // ========================================

  async createIndividualSession(
    studentId: string,
    dto: CreateIndividualSessionDto,
  ) {
    // ========================================
    // FASE 1: VALIDACIONES (HU-19.1.x)
    // ========================================

    // 1. Validar tutor activo
    await this.tutorService.validateTutorActive(dto.tutorId);

    // 2. Validar estudiante ≠ tutor
    await this.validationService.validateStudentNotTutor(
      studentId,
      dto.tutorId,
    );

    // 3. Validar materia existe
    const subject = await this.subjectsService.findById(dto.subjectId);
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    // 4. Validar que tutor imparta esa materia
    const tutorTeachesSubject = await this.subjectsService.tutorTeachesSubject(
      dto.tutorId,
      dto.subjectId,
    );

    if (!tutorTeachesSubject) {
      throw new BadRequestException(
        'El tutor no imparte esta materia',
      );
    }

    // 5. Validar franja disponible
    await this.validationService.validateAvailabilitySlot(
      dto.tutorId,
      dto.availabilityId,
      new Date(dto.scheduledDate),
    );

    // 6. Validar modalidad coincide
    await this.validationService.validateModality(
      dto.availabilityId,
      dto.tutorId,
      dto.modality,
    );

    // 7. Obtener información de la franja para calcular horarios
    const availability = await this.availabilityService.getAvailabilityById(
      dto.availabilityId,
    );

    const startTime = availability.startTime;
    const endTime = this.validationService.calculateEndTime(
      startTime,
      dto.durationHours,
    );

    // 8. Validar no conflicto de horarios
    await this.validationService.validateNoTimeConflict(
      dto.tutorId,
      new Date(dto.scheduledDate),
      startTime,
      dto.durationHours,
    );

    // 9. Validar límite semanal del tutor
    await this.validationService.validateWeeklyHoursLimit(
      dto.tutorId,
      new Date(dto.scheduledDate),
      dto.durationHours,
    );

    // ========================================
    // FASE 2: CREAR SESIÓN (HU-20.1.1)
    // ========================================

    const session = this.sessionRepository.create({
      idTutor: dto.tutorId,
      idSubject: dto.subjectId,
      scheduledDate: new Date(dto.scheduledDate),
      startTime,
      endTime,
      type: SessionType.INDIVIDUAL,
      modality: dto.modality,
      status: SessionStatus.PENDING_TUTOR_CONFIRMATION, // Nuevo estado inicial, mientras el tutor confirma
      title: dto.title,
      description: dto.description,
      tutorConfirmed: false, // El tutor aún no ha confirmado la sesión
    });

    const savedSession = await this.sessionRepository.save(session);

    // ========================================
    // FASE 3: BLOQUEAR FRANJA (HU-20.1.2)
    // ========================================

    const scheduledSession = this.scheduledSessionRepository.create({
      idTutor: dto.tutorId,
      idAvailability: dto.availabilityId,
      idSession: savedSession.idSession,
      scheduledDate: new Date(dto.scheduledDate),
    });

    await this.scheduledSessionRepository.save(scheduledSession);

    // ========================================
    // FASE 4: ASOCIAR ESTUDIANTE (HU-20.1.3)
    // ========================================

    const participation = this.studentParticipateRepository.create({
      idStudent: studentId,
      idSession: savedSession.idSession,
      status: ParticipationStatus.CONFIRMED,
    });

    await this.studentParticipateRepository.save(participation);

    // ========================================
    // FASE 5: NOTIFICACIONES (HU-20.2, HU-20.3)
    // ========================================

    await this.sendTutorConfirmationRequest(savedSession, studentId);

    // ========================================
    // RETORNO
    // ========================================

    return {
      success: true,
      message: 'Solicitud de sesión enviada al tutor. Recibirás una notificación cuando el tutor confirme.',
      session: await this.getSessionById(savedSession.idSession),
    };
  }


  // ========================================
  // RF-20: CONFIRMAR SESIÓN (TUTOR)
  // ========================================

  async confirmSession(
    tutorId: string,
    sessionId: string,
    dto: ConfirmSessionDto,
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
        'Solo el tutor asignado puede confirmar esta sesión',
      );
    }

    // 3. Validar que la sesión esté en estado PENDING_TUTOR_CONFIRMATION
    if (session.status !== SessionStatus.PENDING_TUTOR_CONFIRMATION) {
      throw new BadRequestException(
        `No se puede confirmar una sesión con estado ${session.status}`,
      );
    }

    // 4. Actualizar estado de la sesión
    session.status = SessionStatus.SCHEDULED;
    session.tutorConfirmed = true;
    session.tutorConfirmedAt = new Date();

    await this.sessionRepository.save(session);

    // 5. Enviar notificaciones de confirmación a ambos
    await this.sendConfirmationEmails(session, session.studentParticipateSessions[0].idStudent);

    return {
      success: true,
      message: 'Sesión confirmada exitosamente',
      session: await this.getSessionById(sessionId),
    };
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
      );
    }

    // 6. Crear solicitud de modificación
    const expiresAt = addDays(new Date(), 1); // 24 horas

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
  // 1. Buscar sesión
  const session = await this.sessionRepository.findOne({
    where: { idSession: sessionId },
    relations: ['studentParticipateSessions', 'modificationRequests'],
  });

  if (!session) {
    throw new NotFoundException('Session not found');
  }

  // 2. Buscar solicitud de modificación pendiente
  const pendingRequest = session.modificationRequests.find(
    (r) => r.status === ModificationStatus.PENDING,
  );

  if (!pendingRequest) {
    throw new NotFoundException(
      'No hay solicitud de modificación pendiente',
    );
  }

  // 3. Validar que el usuario sea el receptor (no el solicitante)
  const isParticipant = session.studentParticipateSessions.some(
    (p) => p.idStudent === userId,
  );
  const isTutor = session.idTutor === userId;

  if (!isParticipant && !isTutor) {
    throw new ForbiddenException('No tienes permiso para responder');
  }

  if (pendingRequest.requestedBy === userId) {
    throw new BadRequestException(
      'No puedes responder tu propia solicitud',
    );
  }

  // 4. Validar que no haya expirado (HU-22.1.3, HU-22.2.3)
  if (new Date() > pendingRequest.expiresAt) {
    pendingRequest.status = ModificationStatus.EXPIRED;
    await this.modificationRequestRepository.save(pendingRequest);

    session.status = SessionStatus.SCHEDULED;
    await this.sessionRepository.save(session);

    throw new BadRequestException(
      'La solicitud de modificación ha expirado',
    );
  }

  // 5. Procesar respuesta
  if (accept) {
    //  ACEPTAR (HU-22.3.1)

    // Aplicar cambios a la sesión
    if (pendingRequest.newScheduledDate) {
      session.scheduledDate = pendingRequest.newScheduledDate;
    }

    if (pendingRequest.newAvailabilityId || pendingRequest.newScheduledDate) {
      //  Cambio: Usar UPDATE en lugar de DELETE + INSERT
      const scheduledSession = await this.scheduledSessionRepository.findOne({
        where: { idSession: sessionId },
      });

      if (!scheduledSession) {
        throw new NotFoundException(
          'ScheduledSession not found for this session',
        );
      }

      // Actualizar availability si cambió
      if (pendingRequest.newAvailabilityId) {
        const newAvailability =
          await this.availabilityService.getAvailabilityById(
            pendingRequest.newAvailabilityId,
          );

        session.startTime = newAvailability.startTime;

        const duration =
          pendingRequest.newDurationHours ||
          this.calculateDurationFromSession(session);
        session.endTime = this.validationService.calculateEndTime(
          newAvailability.startTime,
          duration,
        );

        //  UPDATE simple
        scheduledSession.idAvailability = pendingRequest.newAvailabilityId;
      }

      // Actualizar fecha si cambió
      if (pendingRequest.newScheduledDate) {
        //  UPDATE simple
        scheduledSession.scheduledDate = pendingRequest.newScheduledDate;
      }

      //  SAVE único
      await this.scheduledSessionRepository.save(scheduledSession);
    }

    if (pendingRequest.newModality) {
      session.modality = pendingRequest.newModality;
    }

    if (pendingRequest.newDurationHours) {
      session.endTime = this.validationService.calculateEndTime(
        session.startTime,
        pendingRequest.newDurationHours,
      );
    }

    session.status = SessionStatus.SCHEDULED;
    await this.sessionRepository.save(session);

    pendingRequest.status = ModificationStatus.ACCEPTED;
  } else {
    //  RECHAZAR (HU-22.3.2)
    session.status = SessionStatus.SCHEDULED;
    await this.sessionRepository.save(session);

    pendingRequest.status = ModificationStatus.REJECTED;
  }

  pendingRequest.respondedBy = userId;
  pendingRequest.respondedAt = new Date();
  await this.modificationRequestRepository.save(pendingRequest);

  // 6. Notificar resultado
  await this.sendModificationResponseEmail(session, pendingRequest, accept);

  return {
    success: true,
    message: accept
      ? 'Modificación aceptada exitosamente'
      : 'Modificación rechazada',
  };
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

  async getMySessionsAsStudent(studentId: string) {
    const participations = await this.studentParticipateRepository.find({
      where: { idStudent: studentId },
      relations: [
        'session',
        'session.tutor',
        'session.tutor.user',
        'session.subject',
      ],
      order: {
        session: {
          scheduledDate: 'DESC',
        },
      },
    });

    return participations.map((p) => this.mapToSummaryDto(p.session));
  }

  async getMySessionsAsTutor(tutorId: string) {
    const sessions = await this.sessionRepository.find({
      where: { idTutor: tutorId },
      relations: [
        'subject',
        'studentParticipateSessions',
        'studentParticipateSessions.student',
        'studentParticipateSessions.student.user',
      ],
      order: {
        scheduledDate: 'DESC',
      },
    });

    return sessions.map((s) => this.mapToSummaryDto(s));
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

  private mapToSummaryDto(session: Session): any {
    return {
      id: session.idSession,
      title: session.title,
      scheduledDate: session.scheduledDate,
      startTime: session.startTime,
      endTime: session.endTime,
      modality: session.modality,
      status: session.status,
      subject: session.subject?.name || 'Unknown',
    };
  }
}