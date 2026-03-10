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
    // ✅ Solo repositorios del dominio Scheduling
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,

    // ✅ Servicios de otros módulos
    private readonly availabilityService: AvailabilityService,
    private readonly tutorService: TutorService,
  ) {}

  /**
   * HU-19.1.1: Validar que estudiante ≠ tutor
   */
  async validateStudentNotTutor(
    studentId: string,
    tutorId: string,
  ): Promise<void> {
    if (studentId === tutorId) {
      throw new BadRequestException(
        'No puedes agendar una tutoría contigo mismo',
      );
    }
  }

  /**
   * HU-19.1.3: Validar que modalidad coincida con la franja
   */
  async validateModality(
    availabilityId: number, // ✅ CAMBIADO a number
    tutorId: string,
    requestedModality: Modality,
  ): Promise<void> {
    // ✅ Delega al AvailabilityService
    await this.availabilityService.validateModalityForSlot(
      availabilityId,
      tutorId,
      requestedModality,
    );
  }

  /**
   * HU-19.1.1: Validar que la franja esté disponible en esa fecha
   */
  async validateAvailabilitySlot(
    tutorId: string,
    availabilityId: number, // ✅ CAMBIADO a number
    scheduledDate: Date,
  ): Promise<void> {
    // ✅ Delega al AvailabilityService
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

  /**
   * Validar que no haya conflictos de horario con otras sesiones del tutor
   */
  async validateNoTimeConflict(
    tutorId: string,
    scheduledDate: Date,
    startTime: string,
    durationHours: number,
  ): Promise<void> {
    // Calcular endTime
    const endTime = this.calculateEndTime(startTime, durationHours);

    // ✅ Solo consulta repositorio de Session (su propio dominio)
    const sessions = await this.sessionRepository.find({
      where: {
        idTutor: tutorId,
        scheduledDate: scheduledDate,
      },
    });

    // Filtrar solo sesiones activas
    const activeSessions = sessions.filter((s) =>
      [SessionStatus.SCHEDULED, SessionStatus.PENDING_MODIFICATION].includes(
        s.status,
      ),
    );

    // Verificar solapamiento
    for (const session of activeSessions) {
      const sessionStart = this.timeToMinutes(session.startTime);
      const sessionEnd = this.timeToMinutes(session.endTime);
      const requestStart = this.timeToMinutes(startTime);
      const requestEnd = this.timeToMinutes(endTime);

      // Hay solapamiento si:
      // (nuevo inicio < fin existente) Y (nuevo fin > inicio existente)
      if (requestStart < sessionEnd && requestEnd > sessionStart) {
        throw new ConflictException(
          `Ya tienes una sesión agendada de ${session.startTime} a ${session.endTime}`,
        );
      }
    }
  }

  /**
   * HU-19.1.4: Validar límite semanal del tutor
   */
  async validateWeeklyHoursLimit(
    tutorId: string,
    scheduledDate: Date,
    durationHours: number,
  ): Promise<void> {
    // Calcular inicio y fin de la semana
    const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 }); // Lunes
    const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 }); // Domingo

    // ✅ Solo consulta repositorio de Session (su propio dominio)
    const sessions = await this.sessionRepository
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
      })
      .getMany();

    // Calcular horas totales
    const totalHours = sessions.reduce((sum, session) => {
      const duration = this.calculateDurationFromTimes(
        session.startTime,
        session.endTime,
      );
      return sum + duration;
    }, 0);

    // ✅ Obtener límite desde TutorService
    const weeklyLimit = await this.tutorService.getWeeklyHoursLimit(tutorId);

    // Validar
    if (totalHours + durationHours > weeklyLimit) {
      throw new BadRequestException(
        'El tutor ha alcanzado su límite de horas esta semana',
      );
    }
  }

  /**
   * HU-21.1.1: Validar cancelación con 24h de anticipación
   * @returns true si es >= 24h, false si es < 24h
   */
  validateCancellationTime(
    sessionDate: Date,
    sessionStartTime: string,
  ): boolean {
    const now = new Date();

    // Combinar fecha y hora de la sesión
    const sessionDateTime = this.combineDateAndTime(
      sessionDate,
      sessionStartTime,
    );

    // Calcular diferencia en horas
    const hoursUntilSession = differenceInHours(sessionDateTime, now);

    return hoursUntilSession >= 24;
  }

  // ========================================
  // HELPERS PÚBLICOS (usados por SessionService)
  // ========================================

  /**
   * Calcula endTime sumando duration a startTime
   */
  calculateEndTime(startTime: string, durationHours: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = addHours(startDate, durationHours);

    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  // ========================================
  // HELPERS PRIVADOS
  // ========================================

  /**
   * Convierte HH:mm a minutos totales
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calcula duración en horas entre startTime y endTime
   */
  private calculateDurationFromTimes(
    startTime: string,
    endTime: string,
  ): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    return (endMinutes - startMinutes) / 60; // Retorna en horas
  }

  /**
   * Combina fecha y hora en un solo Date object
   */
  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }
}