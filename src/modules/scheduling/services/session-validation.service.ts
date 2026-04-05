// src/modules/scheduling/services/session-validation.service.ts
 
import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { AvailabilityService } from '../../availability/services/availability.service';
import { TutorService } from '../../tutor/services/tutor.service';
import { startOfWeek, endOfWeek, differenceInHours, addHours } from 'date-fns';
import { Modality } from 'src/modules/availability/enums/modality.enum';
 
@Injectable()
export class SessionValidationService {
  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,
    private readonly availabilityService: AvailabilityService,
    private readonly tutorService: TutorService,
  ) {}
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.1 — Estudiante ≠ Tutor
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateStudentNotTutor(studentId: string, tutorId: string): Promise<void> {
    if (studentId === tutorId) {
      throw new BadRequestException('No puedes agendar una tutoría contigo mismo');
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.3 — Modalidad coincide con la franja
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateModality(
    availabilityId: number,
    tutorId: string,
    requestedModality: Modality,
  ): Promise<void> {
    await this.availabilityService.validateModalityForSlot(
      availabilityId,
      tutorId,
      requestedModality,
    );
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.1 — Franja disponible para esa fecha + duración completa
  //
  // Consolida las dos validaciones anteriores (slot exacto disponible +
  // desbordamiento) en un solo método. Se usa en:
  //   - createIndividualSession   (nuevo agendamiento)
  //   - proposeModification       (cuando cambia availabilityId)
  //   - respondToModification     (re-validación al aceptar, 24h después)
  //
  // Recuerda: el mismo slot puede estar libre en fecha A y ocupado en fecha B.
  // La validación filtra siempre por scheduledDate, así que dos estudiantes
  // pueden reservar el mismo slot para semanas distintas sin problema.
  //
  // @param excludeSessionId  Excluir esta sesión del chequeo de solapamiento
  //                          (necesario al modificar una sesión existente para
  //                          que no se bloquee a sí misma).
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateAvailabilitySlotWithDuration(
    tutorId: string,
    availabilityId: number,
    scheduledDate: Date,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const result = await this.availabilityService.isSlotAvailableForDateWithDuration(
      tutorId,
      availabilityId,
      scheduledDate,
      durationHours,
      excludeSessionId,
    );
 
    if (!result.available) {
      throw new ConflictException(
        result.reason ?? 'El horario seleccionado no está disponible para esa duración',
      );
    }
  }
 
  /**
   * @deprecated Usar validateAvailabilitySlotWithDuration.
   * Se mantiene solo para compatibilidad con llamadas que aún no se migraron.
   */
  async validateAvailabilitySlot(
    tutorId: string,
    availabilityId: number,
    scheduledDate: Date,
  ): Promise<void> {
    const isAvailable = await this.availabilityService.isSlotAvailableForDate(
      tutorId,
      availabilityId,
      scheduledDate,
    );
 
    if (!isAvailable) {
      throw new ConflictException('Esta franja ya está reservada para esa fecha');
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Conflicto de horario con otras sesiones del tutor
  //
  // Valida contra sesiones SCHEDULED y PENDING_MODIFICATION.
  // No valida contra PENDING_TUTOR_CONFIRMATION a propósito: varias solicitudes
  // pendientes para el mismo horario están permitidas (el tutor elige una y
  // auto-rechaza las demás). La colisión real se resuelve en confirmSession().
  //
  // @param excludeSessionId  Excluir al validar modificaciones (la sesión
  //                          modificada no debe bloquearse a sí misma).
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateNoTimeConflict(
    tutorId: string,
    scheduledDate: Date,
    startTime: string,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const endTime = this.calculateEndTime(startTime, durationHours);
 
    const dateOnly = new Date(scheduledDate);
    dateOnly.setHours(0, 0, 0, 0);
 
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('DATE(session.scheduledDate) = DATE(:scheduledDate)', { scheduledDate: dateOnly })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
        ],
      });
 
    if (excludeSessionId) {
      qb.andWhere('session.idSession != :excludeSessionId', { excludeSessionId });
    }
 
    const conflictingSessions = await qb.getMany();
 
    for (const session of conflictingSessions) {
      const hasOverlap =
        startTime < session.endTime && endTime > session.startTime;
 
      if (hasOverlap) {
        throw new BadRequestException(
          `Ya tienes una sesión de ${session.startTime} a ${session.endTime} el ` +
          `${dateOnly.toISOString().split('T')[0]}. El horario propuesto (${startTime}–${endTime}) se solapa.`,
        );
      }
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.4 — Límite semanal del tutor
  //
  // Suma las horas de sesiones SCHEDULED y PENDING_MODIFICATION de la semana.
  // Incluye PENDING_MODIFICATION porque esas sesiones siguen ocupando tiempo
  // en el calendario del tutor mientras se resuelve la propuesta.
  //
  // No incluye PENDING_TUTOR_CONFIRMATION: son solicitudes que el tutor
  // aún no aceptó, por lo que no cuentan contra su cuota.
  //
  // @param excludeSessionId  Para modificaciones: excluir la sesión actual
  //                          para que su duración original no se cuente dos veces.
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateWeeklyHoursLimit(
    tutorId: string,
    scheduledDate: Date,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
    const weekEnd   = endOfWeek(scheduledDate,   { weekStartsOn: 1 });
 
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('session.scheduledDate BETWEEN :weekStart AND :weekEnd', {
        weekStart,
        weekEnd,
      })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
        ],
      });
 
    if (excludeSessionId) {
      qb.andWhere('session.idSession != :excludeSessionId', { excludeSessionId });
    }
 
    const sessions = await qb.getMany();
 
    const hoursThisWeek = sessions.reduce((sum, s) => {
      return sum + this.calcDuration(s.startTime, s.endTime);
    }, 0);
 
    const weeklyLimit = await this.tutorService.getWeeklyHoursLimit(tutorId);
 
    if (hoursThisWeek + durationHours > weeklyLimit) {
      throw new BadRequestException(
        `El tutor ha alcanzado su límite semanal de ${weeklyLimit}h ` +
        `(${hoursThisWeek}h usadas + ${durationHours}h solicitadas = ` +
        `${hoursThisWeek + durationHours}h).`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-21.1.1 — Cancelación con ≥ 24h de anticipación
  // Retorna true si quedan ≥ 24h, false si ya es tarde.
  // ─────────────────────────────────────────────────────────────────────────
 
  validateCancellationTime(sessionDate: Date, sessionStartTime: string): boolean {
    const sessionDateTime = this.combineDateAndTime(sessionDate, sessionStartTime);
    return differenceInHours(sessionDateTime, new Date()) >= 24;
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PÚBLICOS (usados por SessionService)
  // ─────────────────────────────────────────────────────────────────────────
 
  calculateEndTime(startTime: string, durationHours: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = addHours(startDate, durationHours);
    return (
      `${String(endDate.getHours()).padStart(2, '0')}:` +
      `${String(endDate.getMinutes()).padStart(2, '0')}`
    );
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────
 
  private calcDuration(startTime: string, endTime: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMin(endTime) - toMin(startTime)) / 60;
  }
 
  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }
}