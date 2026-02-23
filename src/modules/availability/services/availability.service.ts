import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Availability } from '../entities/availability.entity';
import { TutorHaveAvailability } from '../entities/tutor-availability.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { UpdateSlotDto } from '../dto/update-slot.dto';
import { DeleteSlotDto } from '../dto/delete-slot.dto';
import { DayOfWeekToNumber, NumberToDayOfWeek } from '../enums/day-of-week.enum';

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
   * Actualiza una franja de disponibilidad existente del tutor.
   * Permite actualizar startTime y/o modality.
   * No permite actualizar dayOfWeek (se debe eliminar y crear nueva).
   * 
   * @param tutorId - UUID del tutor
   * @param dto - Datos a actualizar (slotId, startTime opcional, modality opcional)
   * @returns Franja actualizada con toda la información
   */
  async updateSlot(tutorId: string, dto: UpdateSlotDto) {
    // 1. Buscar la asignación actual del tutor con ese slotId
    const tutorAvailability = await this.tutorHaveAvailabilityRepository.findOne({
      where: {
        idTutor: tutorId,
        idAvailability: dto.slotId,
      },
      relations: ['availability'],
    });

    if (!tutorAvailability) {
      throw new NotFoundException(
        'Franja de disponibilidad no encontrada o no pertenece al tutor',
      );
    }

    const currentAvailability = tutorAvailability.availability;
    let updatedAvailability = currentAvailability;

    // 2. Si se actualiza el startTime, manejar el cambio
    if (dto.startTime && dto.startTime !== currentAvailability.startTime) {
      // Validar no solapamiento con el nuevo startTime (excluyendo el slot actual)
      await this.validateNoOverlapExcluding(
        tutorId,
        currentAvailability.dayOfWeek,
        dto.startTime,
        dto.slotId,
      );

      // Buscar o crear el nuevo slot con el nuevo startTime
      let newAvailability = await this.availabilityRepository.findOne({
        where: {
          dayOfWeek: currentAvailability.dayOfWeek,
          startTime: dto.startTime,
        },
      });

      if (!newAvailability) {
        newAvailability = this.availabilityRepository.create({
          dayOfWeek: currentAvailability.dayOfWeek,
          startTime: dto.startTime,
        });
        newAvailability = await this.availabilityRepository.save(newAvailability);
      }

      // Verificar que el tutor no tenga ya el nuevo slot asignado
      const existingAssignment = await this.tutorHaveAvailabilityRepository.findOne({
        where: {
          idTutor: tutorId,
          idAvailability: newAvailability.idAvailability,
        },
      });

      if (existingAssignment) {
        throw new ConflictException(
          'Ya tienes asignado un slot en ese nuevo horario',
        );
      }

      // IMPORTANTE: Con PK compuesta, no podemos cambiar idAvailability y hacer save()
      // Eso haría INSERT dejando el registro viejo huérfano
      // Solución: Eliminar el viejo y crear el nuevo explícitamente

      // Guardar la modality actual (por si se actualizó también)
      const modalityToUse = dto.modality || tutorAvailability.modality;

      // Eliminar el registro viejo
      await this.tutorHaveAvailabilityRepository.remove(tutorAvailability);

      // Crear el nuevo registro con el nuevo slot
      const newTutorAvailability = this.tutorHaveAvailabilityRepository.create({
        idTutor: tutorId,
        idAvailability: newAvailability.idAvailability,
        modality: modalityToUse,
      });

      await this.tutorHaveAvailabilityRepository.save(newTutorAvailability);
      updatedAvailability = newAvailability;
    } else if (dto.modality && dto.modality !== tutorAvailability.modality) {
      // Si solo se actualiza modality (sin cambiar startTime), sí podemos hacer update
      tutorAvailability.modality = dto.modality;
      await this.tutorHaveAvailabilityRepository.save(tutorAvailability);
    }

    // 4. Retornar la franja actualizada
    return {
      slotId: updatedAvailability.idAvailability,
      tutorId: tutorId,
      dayOfWeek: NumberToDayOfWeek[updatedAvailability.dayOfWeek],
      startTime: updatedAvailability.startTime,
      modality: tutorAvailability.modality,
      duration: 0.5,
    };
  }

  /**
   * Elimina una franja de disponibilidad del tutor.
   * Solo elimina la asignación en tutor_have_availability.
   * El registro en availability se mantiene para otros tutores.
   * 
   * @param tutorId - UUID del tutor
   * @param dto - Datos de eliminación (slotId)
   * @returns Mensaje de confirmación
   */
  async deleteSlot(tutorId: string, dto: DeleteSlotDto) {
    // 1. Buscar la asignación del tutor con ese slotId
    const tutorAvailability = await this.tutorHaveAvailabilityRepository.findOne({
      where: {
        idTutor: tutorId,
        idAvailability: dto.slotId,
      },
    });

    if (!tutorAvailability) {
      throw new NotFoundException(
        'Franja de disponibilidad no encontrada o no pertenece al tutor',
      );
    }

    // 2. Eliminar solo la asignación del tutor (no el slot de availability)
    await this.tutorHaveAvailabilityRepository.remove(tutorAvailability);

    // 3. Retornar confirmación
    return {
      message: 'Franja de disponibilidad eliminada exitosamente',
      slotId: dto.slotId,
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
   * Valida que no haya solapamiento excluyendo un slot específico (para updates).
   * 
   * @param tutorId - UUID del tutor
   * @param dayOfWeek - Número del día (0-5)
   * @param startTime - Hora de inicio (HH:mm)
   * @param excludeSlotId - ID del slot a excluir de la validación
   */
  private async validateNoOverlapExcluding(
    tutorId: string,
    dayOfWeek: number,
    startTime: string,
    excludeSlotId: number,
  ): Promise<void> {
    const existingSlots = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoin('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('a.startTime = :startTime', { startTime })
      .andWhere('a.idAvailability != :excludeSlotId', { excludeSlotId })
      .getCount();

    if (existingSlots > 0) {
      throw new ConflictException(
        'Ya existe otra franja en ese horario para este día',
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
