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
import {
  startOfWeek,
  endOfWeek,
  differenceInHours,
  addHours,
  parseISO,
} from 'date-fns';
import { Modality } from '../../availability/enums/modality.enum';

// Mapa de dayOfWeek numérico (guardado en Availability) al índice JS de día.
// Availability usa: 0=Lunes, 1=Martes, ..., 5=Sábado  (sin domingo)
// Date.getUTCDay() usa: 0=Domingo, 1=Lunes, ..., 6=Sábado
// No usamos getDay() porque depende de la zona horaria del proceso.
const AVAILABILITY_DAY_TO_UTC_DAY: Record<number, number> = {
  0: 1, // Lunes
  1: 2, // Martes
  2: 3, // Miércoles
  3: 4, // Jueves
  4: 5, // Viernes
  5: 6, // Sábado
};

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
  // NUEVO — El día de semana de scheduledDate coincide con el dayOfWeek
  //         registrado en el slot de disponibilidad seleccionado.
  //
  // Se llama en createIndividualSession y proposeModification (cuando cambia
  // availabilityId o scheduledDate).
  //
  // Por qué parseamos el string directamente en lugar de usar new Date():
  //   new Date('2025-04-07') crea medianoche UTC. En servidores Colombia
  //   (UTC-5) getDay() devuelve el día anterior. Parsear año/mes/día del
  //   string y usar getUTCDay() es zona-horaria-seguro.
  // ─────────────────────────────────────────────────────────────────────────

  async validateScheduledDateMatchesSlotDay(
    availabilityId: number,
    scheduledDate: string, // 'YYYY-MM-DD'
  ): Promise<void> {
    const availability =
      await this.availabilityService.getAvailabilityById(availabilityId);

    // Parsear YYYY-MM-DD sin convertir zonas horarias
    const [year, month, day] = scheduledDate.split('-').map(Number);
    // Usamos Date.UTC para construir la fecha en UTC puro y getUTCDay() para leer el día
    const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    const expectedUtcDay = AVAILABILITY_DAY_TO_UTC_DAY[availability.dayOfWeek];

    if (expectedUtcDay === undefined) {
      throw new BadRequestException(
        `El slot tiene un dayOfWeek (${availability.dayOfWeek}) fuera del rango esperado (0–5)`,
      );
    }

    if (utcDay !== expectedUtcDay) {
      const DAY_NAMES = [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ];
      throw new BadRequestException(
        `La fecha ${scheduledDate} corresponde a un ${DAY_NAMES[utcDay]}, ` +
          `pero el slot seleccionado solo está disponible los ${DAY_NAMES[expectedUtcDay]}.`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.1 — Franja disponible para esa fecha + duración completa
  //
  // scheduledDate se recibe como string 'YYYY-MM-DD' y se pasa así al
  // AvailabilityService, que lo compara directamente en la query de BD
  // (columna tipo date). No construimos Date para evitar desfases.
  // ─────────────────────────────────────────────────────────────────────────

  async validateAvailabilitySlotWithDuration(
    tutorId: string,
    availabilityId: number,
    scheduledDate: string, // 'YYYY-MM-DD'
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
      throw new ConflictException(
        'Esta franja ya está reservada para esa fecha',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conflicto de horario con otras sesiones del tutor
  //
  // scheduledDate es string 'YYYY-MM-DD'. La comparación DATE(session.scheduledDate)
  // funciona igual con strings en Postgres, sin conversión de zona horaria.
  // ─────────────────────────────────────────────────────────────────────────

  async validateNoTimeConflict(
    tutorId: string,
    scheduledDate: string, // 'YYYY-MM-DD'
    startTime: string,
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const endTime = this.calculateEndTime(startTime, durationHours);

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('DATE(session.scheduledDate) = :scheduledDate', {
        scheduledDate,
      })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
        ],
      });

    if (excludeSessionId) {
      qb.andWhere('session.idSession != :excludeSessionId', {
        excludeSessionId,
      });
    }

    const conflictingSessions = await qb.getMany();

    for (const session of conflictingSessions) {
      const overlaps =
        startTime < session.endTime && endTime > session.startTime;
      if (overlaps) {
        throw new BadRequestException(
          `Ya tienes una sesión de ${session.startTime} a ${session.endTime} el ${scheduledDate}. ` +
            `El horario propuesto (${startTime}–${endTime}) se solapa.`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.4 — Límite diario del tutor
  //
  // Valida que las horas AGENDADAS en un día específico no excedan el límite
  // diario (máximo 4 horas). Solo cuenta sesiones SCHEDULED + PENDING_MODIFICATION
  // ─────────────────────────────────────────────────────────────────────────

  async validateDailyHoursLimit(
    tutorId: string,
    scheduledDate: string, // 'YYYY-MM-DD'
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('DATE(session.scheduledDate) = :scheduledDate', {
        scheduledDate,
      })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
        ],
      });

    if (excludeSessionId) {
      qb.andWhere('session.idSession != :excludeSessionId', {
        excludeSessionId,
      });
    }

    const sessions = await qb.getMany();

    const hoursThisDay = sessions.reduce(
      (sum, s) => sum + this.calcDurationFromTimes(s.startTime, s.endTime),
      0,
    );

    const DAILY_HOURS_LIMIT = 4; // Máximo 4 horas por día

    if (hoursThisDay + durationHours > DAILY_HOURS_LIMIT) {
      throw new BadRequestException(
        `El tutor ha alcanzado su límite diario de ${DAILY_HOURS_LIMIT}h ` +
          `(${hoursThisDay}h usadas + ${durationHours}h solicitadas = ` +
          `${hoursThisDay + durationHours}h).`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HU-19.1.4 — Límite semanal del tutor
  //
  // Usamos parseISO (date-fns) para construir el Date de referencia desde
  // el string, que internamente usa UTC y luego startOfWeek/endOfWeek lo
  // ajusta correctamente.
  // ─────────────────────────────────────────────────────────────────────────

  async validateWeeklyHoursLimit(
    tutorId: string,
    scheduledDate: string, // 'YYYY-MM-DD'
    durationHours: number,
    excludeSessionId?: string,
  ): Promise<void> {
    // parseISO('2025-04-07') → Date en UTC, sin ambigüedad de zona horaria
    const refDate = parseISO(scheduledDate);
    const weekStart = startOfWeek(refDate, { weekStartsOn: 1 }); // Lunes
    const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 }); // Domingo

    const qb = this.sessionRepository
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
      qb.andWhere('session.idSession != :excludeSessionId', {
        excludeSessionId,
      });
    }

    const sessions = await qb.getMany();

    const hoursThisWeek = sessions.reduce(
      (sum, s) => sum + this.calcDurationFromTimes(s.startTime, s.endTime),
      0,
    );

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
  // ─────────────────────────────────────────────────────────────────────────

  validateCancellationTime(
    sessionDate: string,
    sessionStartTime: string,
  ): boolean {
    // Parsear 'YYYY-MM-DD' y 'HH:mm' sin ambigüedad de zona horaria
    const [year, month, day] = sessionDate.split('-').map(Number);
    const [hours, minutes] = sessionStartTime.split(':').map(Number);
    const sessionDateTime = new Date(
      Date.UTC(year, month - 1, day, hours, minutes),
    );
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

  private calcDurationFromTimes(startTime: string, endTime: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return (toMin(endTime) - toMin(startTime)) / 60;
  }
}
