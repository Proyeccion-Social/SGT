// src/modules/scheduling/services/session-validation.service.ts
// CAMBIOS RESPECTO A LA VERSIÓN ACTUAL:
//
// 1. validateMinimumBookingAdvance (NUEVO):
//    La fecha+hora de la sesión debe ser al menos 6 horas en el futuro.
//    Calcula el timestamp de la sesión en UTC y lo compara con now.
//
// 2. validateModificationAdvanceTime (NUEVO):
//    Solo se puede proponer una modificación si la sesión es en más de 3 días.
//    Usa el mismo patrón UTC-safe que validateCancellationTime.
//
// 3. calculateConfirmationExpiry (NUEVO, helper público):
//    Calcula el timestamp confirmationExpiresAt = scheduledDateTime - 6h.
//    Lo usa SessionService al crear la sesión para persistirlo.
//
// Todo lo demás permanece igual.
 
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
import {
  startOfWeek,
  endOfWeek,
  differenceInHours,
  addHours,
  parseISO,
} from 'date-fns';
import { Modality } from '../../availability/enums/modality.enum';
 
const AVAILABILITY_DAY_TO_UTC_DAY: Record<number, number> = {
  0: 1, // Lunes
  1: 2, // Martes
  2: 3, // Miércoles
  3: 4, // Jueves
  4: 5, // Viernes
  5: 6, // Sábado
};
 
/** Horas mínimas de anticipación para agendar una sesión. */
const MIN_BOOKING_ADVANCE_HOURS = 6;
 
/** Días máximos de anticipación para proponer una modificación. */
const MAX_MODIFICATION_ADVANCE_DAYS = 3;
 
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
 
  validateStudentNotTutor(studentId: string, tutorId: string): void {
    if (studentId === tutorId) {
      throw new BadRequestException(
        'No puedes agendar una tutoría contigo mismo',
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // NUEVO — Anticipación mínima para agendar (6 horas)
  //
  // Se llama en createIndividualSession después de obtener el startTime
  // de la disponibilidad, porque necesitamos la hora exacta de la sesión,
  // no solo la fecha.
  //
  // Por qué Date.UTC:
  //   scheduledDate es 'YYYY-MM-DD' y startTime es 'HH:mm'.
  //   Construir con Date.UTC evita que la zona horaria del servidor
  //   desplace el timestamp resultante.
  // ─────────────────────────────────────────────────────────────────────────
 
  validateMinimumBookingAdvance(
    scheduledDate: string,  // 'YYYY-MM-DD'
    startTime: string,      // 'HH:mm'
  ): void {
    const sessionDateTime = this.buildSessionDateTime(scheduledDate, startTime);
    const hoursUntilSession = differenceInHours(sessionDateTime, new Date());
 
    if (hoursUntilSession < MIN_BOOKING_ADVANCE_HOURS) {
      throw new BadRequestException(
        `Solo puedes agendar sesiones con al menos ${MIN_BOOKING_ADVANCE_HOURS} horas de anticipación. ` +
        `Esta sesión comienza en ${hoursUntilSession < 0 ? 0 : hoursUntilSession} hora(s).`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // NUEVO — Anticipación máxima para proponer modificación (3 días)
  //
  // Solo se puede proponer una modificación si la sesión es en más de 3 días.
  // Si quedan ≤ 3 días, el cambio de horario/disponibilidad ya no es viable
  // porque la otra parte tiene poco tiempo para responder.
  //
  // Nota: esto valida la fecha ACTUAL de la sesión (antes del cambio),
  // no la fecha propuesta. La lógica es: si la sesión ya está muy próxima,
  // no se puede pedir modificarla aunque se proponga una fecha futura.
  // ─────────────────────────────────────────────────────────────────────────
 
  validateModificationAdvanceTime(
    sessionScheduledDate: string,  // 'YYYY-MM-DD' — fecha actual de la sesión
    sessionStartTime: string,      // 'HH:mm'
  ): void {
    const sessionDateTime = this.buildSessionDateTime(sessionScheduledDate, sessionStartTime);
    const hoursUntilSession = differenceInHours(sessionDateTime, new Date());
    const daysUntilSession = hoursUntilSession / 24;
 
    if (daysUntilSession <= MAX_MODIFICATION_ADVANCE_DAYS) {
      throw new BadRequestException(
        `Solo puedes proponer modificaciones con más de ${MAX_MODIFICATION_ADVANCE_DAYS} días de anticipación. ` +
        `Esta sesión es en ${Math.floor(daysUntilSession)} día(s).`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // NUEVO — Helper público para calcular confirmationExpiresAt
  //
  // Usado por SessionService al crear la sesión para precalcular y persistir
  // el timestamp de expiración de la confirmación.
  // confirmationExpiresAt = scheduledDateTime - 6 horas
  // ─────────────────────────────────────────────────────────────────────────
 
  calculateConfirmationExpiry(
    scheduledDate: string,  // 'YYYY-MM-DD'
    startTime: string,      // 'HH:mm'
  ): Date {
    const sessionDateTime = this.buildSessionDateTime(scheduledDate, startTime);
    // Restar 6 horas = añadir -6 horas
    return new Date(sessionDateTime.getTime() - MIN_BOOKING_ADVANCE_HOURS * 60 * 60 * 1000);
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
  // Día de semana de scheduledDate coincide con dayOfWeek del slot
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateScheduledDateMatchesSlotDay(
    availabilityId: number,
    scheduledDate: string,
  ): Promise<void> {
    const availability =
      await this.availabilityService.getAvailabilityById(availabilityId);
 
    const [year, month, day] = scheduledDate.split('-').map(Number);
    const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const expectedUtcDay = AVAILABILITY_DAY_TO_UTC_DAY[availability.dayOfWeek];
 
    if (expectedUtcDay === undefined) {
      throw new BadRequestException(
        `El slot tiene un dayOfWeek (${availability.dayOfWeek}) fuera del rango esperado (0–5)`,
      );
    }
 
    if (utcDay !== expectedUtcDay) {
      const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      throw new BadRequestException(
        `La fecha ${scheduledDate} corresponde a un ${DAY_NAMES[utcDay]}, ` +
        `pero el slot seleccionado solo está disponible los ${DAY_NAMES[expectedUtcDay]}.`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Franja disponible para esa fecha + duración completa
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateAvailabilitySlotWithDuration(
    tutorId: string,
    availabilityId: number,
    scheduledDate: string,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const result =
      await this.availabilityService.isSlotAvailableForDateWithDuration(
        tutorId,
        availabilityId,
        scheduledDate,
        durationHours,
        excludeSessionId,
      );
 
    if (!result.available) {
      throw new ConflictException(
        result.reason ??
          'El horario seleccionado no está disponible para esa duración',
      );
    }
  }
 
  /** @deprecated Usar validateAvailabilitySlotWithDuration */
  async validateAvailabilitySlot(
    tutorId: string,
    availabilityId: number,
    scheduledDate: string,
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
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateNoTimeConflict(
    tutorId: string,
    scheduledDate: string,
    startTime: string,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const endTime = this.calculateEndTime(startTime, durationHours);
 
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('DATE(session.scheduledDate) = :scheduledDate', { scheduledDate })
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
      const overlaps = startTime < session.endTime && endTime > session.startTime;
      if (overlaps) {
        throw new BadRequestException(
          `Ya tienes una sesión de ${session.startTime} a ${session.endTime} el ${scheduledDate}. ` +
          `El horario propuesto (${startTime}–${endTime}) se solapa.`,
        );
      }
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Límite diario del tutor (máximo 4 horas)
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateDailyHoursLimit(
    tutorId: string,
    scheduledDate: string,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const requestedDuration = Number(durationHours);
    if (Number.isNaN(requestedDuration)) {
      throw new BadRequestException('durationHours debe ser un numero válido');
    }
 
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('DATE(session.scheduledDate) = :scheduledDate', { scheduledDate })
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
 
    const hoursThisDay = sessions.reduce(
      (sum, s) => sum + this.calcDurationFromTimes(s.startTime, s.endTime),
      0,
    );
 
    const DAILY_HOURS_LIMIT = 4;
 
    if (hoursThisDay + requestedDuration > DAILY_HOURS_LIMIT) {
      throw new BadRequestException(
        `El tutor ha alcanzado su límite diario de ${DAILY_HOURS_LIMIT}h ` +
        `(${hoursThisDay}h usadas + ${requestedDuration}h solicitadas = ` +
        `${hoursThisDay + requestedDuration}h).`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // Límite semanal del tutor
  // ─────────────────────────────────────────────────────────────────────────
 
  async validateWeeklyHoursLimit(
    tutorId: string,
    scheduledDate: string,
    durationHours: number,
    excludeSessionId?: string,
    queryRunner?: any,
  ): Promise<void> {
    const requestedDuration = Number(durationHours);
    if (Number.isNaN(requestedDuration)) {
      throw new BadRequestException('durationHours debe ser un numero válido');
    }
 
    const refDate = parseISO(scheduledDate);
    const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
 
    const source = queryRunner
      ? queryRunner.manager.getRepository(Session)
      : this.sessionRepository;
 
    const qb = source
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('session.scheduledDate BETWEEN :weekStart AND :weekEnd', {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
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
 
    const hoursThisWeek = sessions.reduce(
      (sum, s) => sum + this.calcDurationFromTimes(s.startTime, s.endTime),
      0,
    );
 
    const weeklyLimit = await this.tutorService.getWeeklyHoursLimit(tutorId);
 
    if (hoursThisWeek + requestedDuration > weeklyLimit) {
      throw new BadRequestException(
        `El tutor ha alcanzado su límite semanal de ${weeklyLimit}h ` +
        `(${hoursThisWeek}h usadas + ${requestedDuration}h solicitadas = ` +
        `${hoursThisWeek + requestedDuration}h).`,
      );
    }
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HU-21.1.1 — Cancelación con ≥ 24h de anticipación
  // ─────────────────────────────────────────────────────────────────────────
 
  validateCancellationTime(
    sessionDate: string,
    sessionStartTime: string,
  ): boolean {
    const sessionDateTime = this.buildSessionDateTime(sessionDate, sessionStartTime);
    return differenceInHours(sessionDateTime, new Date()) >= 24;
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PÚBLICOS
  // ─────────────────────────────────────────────────────────────────────────
 
  calculateEndTime(startTime: string, durationHours: number): string {
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const end = addHours(start, durationHours);
    return (
      `${String(end.getHours()).padStart(2, '0')}:` +
      `${String(end.getMinutes()).padStart(2, '0')}`
    );
  }
 
  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────
 
  /**
   * Construye un Date en UTC a partir de 'YYYY-MM-DD' y 'HH:mm'.
   * Centralizado aquí para que todas las comparaciones de fecha+hora
   * sean consistentes y zona-horaria-seguras.
   */
  private buildSessionDateTime(scheduledDate: string, startTime: string): Date {
    const [year, month, day] = scheduledDate.split('-').map(Number);
    const [hours, minutes]   = startTime.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes));
  }
 
  private calcDurationFromTimes(startTime: string, endTime: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMin(endTime) - toMin(startTime)) / 60;
  }
}