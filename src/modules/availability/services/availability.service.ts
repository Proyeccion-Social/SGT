import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Availability } from '../entities/availability.entity';
import { TutorHaveAvailability } from '../entities/tutor-availability.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { UpdateSlotDto } from '../dto/update-slot.dto';
import { DeleteSlotDto } from '../dto/delete-slot.dto';
import { DayOfWeek, DayOfWeekToNumber, NumberToDayOfWeek } from '../enums/day-of-week.enum';
import { ScheduledSession } from 'src/modules/scheduling/entities/scheduled-session.entity';
import { Modality } from '../enums/modality.enum';
import { options } from 'joi';

export interface AvailabilitySlot {
  slotId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string; //  Calculado
  modality: Modality;
  duration: number;
  isAvailable: boolean; //  Si tiene sesión reservada
}

export interface TutorAvailabilityPublic {
  tutorId: string;
  tutorName: string;
  totalSlots: number;
  availableSlots: AvailabilitySlot[];
  groupedByDay: Record<DayOfWeek, AvailabilitySlot[]>;
}
@Injectable()
export class AvailabilityService {

  private readonly SLOT_DURATION_MINUTES = 30;
  private readonly MAX_SLOTS_PER_DAY = 8; // 4 horas
  //private readonly MIN_DAYS_WITH_AVAILABILITY = 2;

  constructor(
    @InjectRepository(Availability,'local')
    private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(TutorHaveAvailability,'local')
    private readonly tutorHaveAvailabilityRepository: Repository<TutorHaveAvailability>,
    
    @InjectRepository(ScheduledSession,'local')
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,
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




  
  // =====================================================
  //  CONSULTA PÚBLICA PARA ESTUDIANTES
  // =====================================================

  /**
   * Obtiene la disponibilidad de un tutor (visible para estudiantes)
   * Incluye solo franjas futuras disponibles (sin reservas)
   */
  async getTutorAvailability(
    tutorId: string,
    options?: {
      onlyAvailable?: boolean; // Solo slots sin reserva
      onlyFuture?: boolean; // Solo slots futuros
      modality?: Modality; // Filtrar por modalidad
    },
  ): Promise<TutorAvailabilityPublic> {
    // 1. Obtener todas las franjas del tutor
    const tutorAvailabilities = await this.tutorHaveAvailabilityRepository.find(
      {
        where: { idTutor: tutorId },
        relations: ['availability', 'tutor', 'tutor.user'],
      },
    );

    if (tutorAvailabilities.length === 0) {
      throw new NotFoundException('Tutor no tiene disponibilidad configurada');
    }

    // 2. Obtener sesiones reservadas para este tutor
    const scheduledSessions = await this.scheduledSessionRepository.find({
      where: {
        idTutor: tutorId,
        //  Solo sesiones futuras si se solicita
        ...(options?.onlyFuture && {
          sessionDate: MoreThanOrEqual(new Date()),
        }),
      },
      relations: ['availability'],
    });

    // Crear set de IDs de availabilities con reserva
    const reservedAvailabilityIds = new Set(
      scheduledSessions.map((s) => s.idAvailability),
    );

    // 3. Mapear y filtrar slots
    let slots: AvailabilitySlot[] = tutorAvailabilities.map((ta) => {
      const isReserved = reservedAvailabilityIds.has(ta.idAvailability.toString());//Convertir a string (Revisar consistencia)
      const startTime = ta.availability.startTime;
      const endTime = this.calculateEndTime(startTime);

      return {
        slotId: ta.idAvailability.toString(), //Convertir a string (Revisar consistencia)
        dayOfWeek: NumberToDayOfWeek[ta.availability.dayOfWeek],
        startTime,
        endTime,
        modality: ta.modality,
        duration: 0.5,
        isAvailable: !isReserved,
      };
    });

    // 4. Aplicar filtros
    if (options?.onlyAvailable) {
      slots = slots.filter((s) => s.isAvailable);
    }

    if (options?.modality) {
      slots = slots.filter((s) => s.modality === options.modality);
    }

    // 5. Agrupar por día
    const groupedByDay = slots.reduce(
      (acc, slot) => {
        if (!acc[slot.dayOfWeek]) {
          acc[slot.dayOfWeek] = [];
        }
        acc[slot.dayOfWeek].push(slot);
        return acc;
      },
      {} as Record<DayOfWeek, AvailabilitySlot[]>,
    );

    // 6. Ordenar cada día por hora
    Object.keys(groupedByDay).forEach((day) => {
      groupedByDay[day as DayOfWeek].sort(
        (a, b) => a.startTime.localeCompare(b.startTime),
      );
    });

    return {
      tutorId,
      tutorName: tutorAvailabilities[0].tutor.user.name,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.isAvailable),
      groupedByDay,
    };
  }

  //  Nuevo método: Listar todos los tutores con disponibilidad
async getAllAvailableTutors(options?: {
  modality?: Modality;
  onlyAvailable?: boolean;
}): Promise<
  Array<{
    tutorId: string;
    tutorName: string;
    totalSlots: number;
    availableSlots: number;
    modalities: Modality[];
  }>
> {
  // Obtener todos los tutores con disponibilidad
  const tutorsWithAvailability = await this.tutorHaveAvailabilityRepository
    .createQueryBuilder('tha')
    .innerJoinAndSelect('tha.tutor', 'tutor')
    .innerJoinAndSelect('tutor.user', 'user')
    .innerJoinAndSelect('tha.availability', 'availability')
    .where('tutor.isActive = :isActive', { isActive: true })
    .andWhere('tutor.profile_completed = :completed', { completed: true })
    .getMany();

  // Agrupar por tutor
  const tutorMap = new Map<
    string,
    {
      tutorId: string;
      tutorName: string;
      slots: TutorHaveAvailability[];
    }
  >();

  tutorsWithAvailability.forEach((ta) => {
    if (!tutorMap.has(ta.idTutor)) {
      tutorMap.set(ta.idTutor, {
        tutorId: ta.idTutor,
        tutorName: ta.tutor.user.name,
        slots: [],
      });
    }
    tutorMap.get(ta.idTutor)!.slots.push(ta);
  });

  // Obtener sesiones reservadas
  const allScheduledSessions = await this.scheduledSessionRepository.find({
    relations: ['session'],
  });

  const reservedByTutor = new Map<string, Set<string>>();
  allScheduledSessions.forEach((ss) => {
    if (!reservedByTutor.has(ss.idTutor)) {
      reservedByTutor.set(ss.idTutor, new Set());
    }
    reservedByTutor.get(ss.idTutor)!.add(ss.idAvailability);
  });

  // Construir resultado
  const result = Array.from(tutorMap.values()).map((tutor) => {
    const reservedSlots = reservedByTutor.get(tutor.tutorId) || new Set();

    let slots = tutor.slots;

    // Filtrar por modalidad si se especifica
    if (options?.modality) {
      slots = slots.filter((s) => s.modality === options.modality);
    }

    const totalSlots = slots.length;
    const availableSlots = slots.filter(
      (s) => !reservedSlots.has(s.idAvailability.toString()),
    ).length;

    // Si onlyAvailable, excluir tutores sin slots disponibles
    if (options?.onlyAvailable && availableSlots === 0) {
      return null;
    }

    // Obtener modalidades únicas
    const modalities = [
      ...new Set(slots.map((s) => s.modality)),
    ] as Modality[];

    return {
      tutorId: tutor.tutorId,
      tutorName: tutor.tutorName,
      totalSlots,
      availableSlots,
      modalities,
    };
  });
  
  return result.filter((r) => r !== null);
  
}



async getTutorsBySubjectWithAvailability(
  subjectId: number,
  options?: {
    onlyAvailable?: boolean;
    modality?: Modality;
  },
): Promise<
  {
    tutorId: string;
    tutorName: string;
    totalSlots: number;
    availableSlots: number;
    modalities: Modality[];
    availability: TutorAvailabilityPublic;
  }[]
> {

  // 1. Obtener tutores que imparten esta materia
  const tutorsWithAvailability = await this.tutorHaveAvailabilityRepository
    .createQueryBuilder('tha')
    .innerJoinAndSelect('tha.tutor', 'tutor')
    .innerJoinAndSelect('tutor.user', 'user')
    .innerJoinAndSelect('tutor.tutorImpartSubjects', 'tis')
    .innerJoinAndSelect('tha.availability', 'availability')
    .where('tutor.isActive = :isActive', { isActive: true })
    .andWhere('tutor.profile_completed = :completed', { completed: true })
    .andWhere('tis.idSubject = :subjectId', { subjectId })
    .getMany();

  if (tutorsWithAvailability.length === 0) {
    return [];
  }

  // 2. Agrupar por tutor
  const tutorMap = new Map<
    string,
    {
      tutorId: string;
      tutorName: string;
      slots: TutorHaveAvailability[];
    }
  >();

  tutorsWithAvailability.forEach((ta: TutorHaveAvailability) => {

    const tutorId = ta.idTutor;

    if (!tutorMap.has(tutorId)) {
      tutorMap.set(tutorId, {
        tutorId,
        tutorName: ta.tutor.user.name,
        slots: [],
      });
    }

    tutorMap.get(tutorId)!.slots.push(ta);
  });

  // 3. Obtener sesiones reservadas
  const allScheduledSessions = await this.scheduledSessionRepository.find({
    where: {
      idTutor: In(Array.from(tutorMap.keys())),
    },
  });

  const reservedByTutor = new Map<string, Set<string>>();

  allScheduledSessions.forEach((ss) => {

    if (!reservedByTutor.has(ss.idTutor)) {
      reservedByTutor.set(ss.idTutor, new Set());
    }

    reservedByTutor.get(ss.idTutor)!.add(String(ss.idAvailability));
  });

  // 4. Construir resultado con disponibilidad detallada
  const result = await Promise.all(
    Array.from(tutorMap.values()).map(async (tutor) => {

      const reservedSlots = reservedByTutor.get(tutor.tutorId) || new Set<string>();

      let slots = tutor.slots;

      // Filtrar por modalidad
      if (options?.modality) {
        slots = slots.filter((s) => s.modality === options.modality);
      }

      const totalSlots = slots.length;

      const availableSlots = slots.filter(
        (s) => !reservedSlots.has(String(s.idAvailability)),
      ).length;

      // Si solo queremos disponibles
      if (options?.onlyAvailable && availableSlots === 0) {
        return null;
      }

      const modalities = [
        ...new Set(slots.map((s) => s.modality)),
      ] as Modality[];

      const availability = await this.getTutorAvailability(tutor.tutorId, {
        onlyAvailable: options?.onlyAvailable,
        modality: options?.modality,
      });

      return {
        tutorId: tutor.tutorId,
        tutorName: tutor.tutorName,
        totalSlots,
        availableSlots,
        modalities,
        availability,
      };
    }),
  );

  return result.filter(
    (r): r is {
      tutorId: string;
      tutorName: string;
      totalSlots: number;
      availableSlots: number;
      modalities: Modality[];
      availability: TutorAvailabilityPublic;
    } => r !== null,
  );
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


  /**
   * Convierte HH:mm a minutos totales
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calcula la hora de fin sumando 30 minutos
   */
  private calculateEndTime(startTime: string): string {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = startMinutes + this.SLOT_DURATION_MINUTES;
    const hours = Math.floor(endMinutes / 60);
    const minutes = endMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}
