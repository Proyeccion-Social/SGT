import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Availability } from '../entities/availability.entity';
import { TutorHaveAvailability } from '../entities/tutor-availability.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { DayOfWeekToNumber } from '../enums/day-of-week.enum';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Availability)
    private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(TutorHaveAvailability)
    private readonly tutorHaveAvailabilityRepository: Repository<TutorHaveAvailability>,
  ) {}

  /**
   * Crea una franja de disponibilidad para un tutor.
   * Si la franja (día + hora) ya existe, la reutiliza.
   * Cada franja tiene duración fija de 30 minutos.
   * 
   * @param tutorId - UUID del tutor
   * @param dto - Datos de la franja a crear
   * @returns Franja creada con toda la información
   */
  async createSlot(tutorId: string, dto: CreateSlotDto) {
    // 1. Convertir día de la semana de string a número (0-5)
    const dayOfWeekNumber = DayOfWeekToNumber[dto.dayOfWeek];

    // 2. Validar no solapamiento con slots existentes del tutor en ese día
    await this.validateNoOverlap(tutorId, dayOfWeekNumber, dto.startTime);

    // 3. Validar máximo de 4 horas diarias (excepto si solo tiene 1 día disponible)
    await this.validateDailyHoursLimit(tutorId, dayOfWeekNumber);

    // 4. Buscar si ya existe un slot con ese día y hora (slot compartido)
    let availability = await this.availabilityRepository.findOne({
      where: {
        dayOfWeek: dayOfWeekNumber,
        startTime: dto.startTime,
      },
    });

    // 5. Si no existe, crear el slot
    if (!availability) {
      availability = this.availabilityRepository.create({
        dayOfWeek: dayOfWeekNumber,
        startTime: dto.startTime,
      });
      availability = await this.availabilityRepository.save(availability);
    }

    // 6. Verificar que el tutor no tenga ya este slot asignado
    const existingAssignment = await this.tutorHaveAvailabilityRepository.findOne({
      where: {
        idTutor: tutorId,
        idAvailability: availability.idAvailability,
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        'El tutor ya tiene asignado este slot de disponibilidad',
      );
    }

    // 7. Crear la asignación tutor → slot con modalidad
    const tutorAvailability = this.tutorHaveAvailabilityRepository.create({
      idTutor: tutorId,
      idAvailability: availability.idAvailability,
      modality: dto.modality,
    });

    await this.tutorHaveAvailabilityRepository.save(tutorAvailability);

    // 8. Retornar la franja creada con toda la información
    return {
      slotId: availability.idAvailability,
      tutorId: tutorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      modality: dto.modality,
      duration: 0.5, // 30 minutos = 0.5 horas
    };
  }

  /**
   * Valida que no haya solapamiento con franjas existentes del tutor en el mismo día.
   * Con slots de 30 min, solo valida que no sea la misma hora exacta.
   * 
   * @param tutorId - UUID del tutor
   * @param dayOfWeek - Número del día (0-5)
   * @param startTime - Hora de inicio (HH:mm)
   */
  private async validateNoOverlap(
    tutorId: string,
    dayOfWeek: number,
    startTime: string,
  ): Promise<void> {
    // Obtener todas las franjas del tutor en ese día
    const existingSlots = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoin('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('a.startTime = :startTime', { startTime })
      .getCount();

    if (existingSlots > 0) {
      throw new ConflictException(
        'Ya existe una franja en ese horario para este día',
      );
    }
  }

  /**
   * Valida que el tutor no exceda el máximo de 4 horas por día.
   * Excepción: Si el tutor solo tiene disponibilidad en 1 día, puede exceder las 4 horas.
   * Cada slot = 30 min = 0.5 horas, máximo 8 slots por día (4 horas).
   * 
   * @param tutorId - UUID del tutor
   * @param dayOfWeek - Número del día (0-5)
   */
  private async validateDailyHoursLimit(
    tutorId: string,
    dayOfWeek: number,
  ): Promise<void> {
    // Contar cuántos slots tiene el tutor en ese día
    const slotsInDay = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoin('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .getCount();

    // Cada slot = 0.5 horas, máximo 8 slots = 4 horas
    const MAX_SLOTS_PER_DAY = 8;

    if (slotsInDay >= MAX_SLOTS_PER_DAY) {
      // Verificar si el tutor solo tiene disponibilidad en 1 día (excepción)
      const daysWithSlots = await this.tutorHaveAvailabilityRepository
        .createQueryBuilder('tha')
        .innerJoin('tha.availability', 'a')
        .select('DISTINCT a.dayOfWeek', 'day')
        .where('tha.idTutor = :tutorId', { tutorId })
        .getRawMany();

      if (daysWithSlots.length > 1) {
        throw new BadRequestException(
          'Excede el máximo diario de 4 horas. Ya tienes 8 slots (4 horas) en este día.',
        );
      }
      // Si solo tiene 1 día, permitir exceder las 4 horas
    }
  }
}
