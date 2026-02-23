import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

    // 2. Buscar si ya existe un slot con ese día y hora (slot compartido)
    let availability = await this.availabilityRepository.findOne({
      where: {
        dayOfWeek: dayOfWeekNumber,
        startTime: dto.startTime,
      },
    });

    // 3. Si no existe, crear el slot
    if (!availability) {
      availability = this.availabilityRepository.create({
        dayOfWeek: dayOfWeekNumber,
        startTime: dto.startTime,
      });
      availability = await this.availabilityRepository.save(availability);
    }

    // 4. Verificar que el tutor no tenga ya este slot asignado
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

    // 5. Crear la asignación tutor → slot con modalidad
    const tutorAvailability = this.tutorHaveAvailabilityRepository.create({
      idTutor: tutorId,
      idAvailability: availability.idAvailability,
      modality: dto.modality,
    });

    await this.tutorHaveAvailabilityRepository.save(tutorAvailability);

    // 6. Retornar la franja creada con toda la información
    return {
      slotId: availability.idAvailability,
      tutorId: tutorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      modality: dto.modality,
      duration: 0.5, // 30 minutos = 0.5 horas
    };
  }
}
