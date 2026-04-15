// src/modules/availability/services/availability.service.ts
//
// Cambios respecto a la versión anterior:
//
// 1. Se añade el helper privado `buildOccupiedMinuteRanges()` que, dado un tutor
//    y una lista de ScheduledSessions activas, calcula los rangos de minutos
//    del día que están realmente ocupados (considerando la duración de la sesión,
//    no solo el slot de inicio).
//
// 2. `isSlotOccupiedByBlock()`: dado un slot (startTime) y los rangos ocupados,
//    determina si ese slot de 30 min queda dentro de algún bloque activo.
//
// 3. getTutorAvailability(): usa la nueva lógica en lugar de comparar solo IDs.
//
// 4. getTutorsBySubjectWithAvailability(): ídem.
//
// 5. Se añade `isSlotAvailableForDateWithDuration()`: versión que también valida
//    que la duración solicitada no se salga de los slots registrados del tutor
//    (cara 2 del problema, desbordamiento del último slot).
//
// El resto del servicio (createSlot, updateSlot, deleteSlot, validaciones privadas)
// no se modifica.

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Availability } from '../entities/availability.entity';
import { TutorHaveAvailability } from '../entities/tutor-availability.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { CreateSlotRangeDto } from '../dto/create-slot-range.dto';
import { UpdateSlotDto } from '../dto/update-slot.dto';
import { DeleteSlotDto } from '../dto/delete-slot.dto';
import {
  DayOfWeek,
  DayOfWeekToNumber,
  NumberToDayOfWeek,
} from '../enums/day-of-week.enum';
import { ScheduledSession } from '../../scheduling/entities/scheduled-session.entity';
import { Modality } from '../enums/modality.enum';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';
import { Session } from '../../scheduling/entities/session.entity';

export interface AvailabilitySlot {
  slotId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  modality: Modality;
  duration: number;
  isAvailable: boolean;
}

export interface TutorAvailabilityPublic {
  tutorId: string;
  tutorName: string;
  totalSlots: number;
  availableSlots: AvailabilitySlot[];
  groupedByDay: Record<DayOfWeek, AvailabilitySlot[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rango de tiempo ocupado (en minutos desde medianoche, dentro de un día)
// ─────────────────────────────────────────────────────────────────────────────
interface OccupiedRange {
  startMinutes: number;
  endMinutes: number;
}

@Injectable()
export class AvailabilityService {
  private readonly SLOT_DURATION_MINUTES = 30;
  private readonly MAX_SLOTS_PER_DAY = 8;

  constructor(
    @InjectRepository(Availability, 'local')
    private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(TutorHaveAvailability, 'local')
    private readonly tutorHaveAvailabilityRepository: Repository<TutorHaveAvailability>,
    @InjectRepository(ScheduledSession, 'local')
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,
  ) {}

  // =====================================================
  // createSlot, updateSlot, deleteSlot — sin cambios
  // =====================================================

  async createSlot(tutorId: string, dto: CreateSlotDto) {
    const dayOfWeekNumber = DayOfWeekToNumber[dto.dayOfWeek];
    await this.validateNoOverlap(tutorId, dayOfWeekNumber, dto.startTime);
    await this.validateDailyHoursLimit(tutorId, dayOfWeekNumber);

    let availability = await this.availabilityRepository.findOne({
      where: { dayOfWeek: dayOfWeekNumber, startTime: dto.startTime },
    });

    if (!availability) {
      availability = this.availabilityRepository.create({
        dayOfWeek: dayOfWeekNumber,
        startTime: dto.startTime,
      });
      availability = await this.availabilityRepository.save(availability);
    }

    const existingAssignment =
      await this.tutorHaveAvailabilityRepository.findOne({
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

    const tutorAvailability = this.tutorHaveAvailabilityRepository.create({
      idTutor: tutorId,
      idAvailability: availability.idAvailability,
      modality: dto.modality,
    });

    await this.tutorHaveAvailabilityRepository.save(tutorAvailability);

    return {
      slotId: availability.idAvailability,
      tutorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      modality: dto.modality,
      duration: 0.5,
    };
  }

  async createSlotsInRange(tutorId: string, dto: CreateSlotRangeDto) {
    const dayOfWeekNumber = DayOfWeekToNumber[dto.dayOfWeek];
    const slotTimes = this.buildSlotTimesFromRange(dto.startTime, dto.endTime);

    return this.availabilityRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const availabilityRepository =
          transactionalEntityManager.getRepository(Availability);
        const tutorHaveAvailabilityRepository =
          transactionalEntityManager.getRepository(TutorHaveAvailability);

        const existingSlotsInDay = await tutorHaveAvailabilityRepository
          .createQueryBuilder('tha')
          .innerJoin('tha.availability', 'a')
          .where('tha.idTutor = :tutorId', { tutorId })
          .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek: dayOfWeekNumber })
          .getCount();

        if (existingSlotsInDay + slotTimes.length > this.MAX_SLOTS_PER_DAY) {
          throw new BadRequestException({
            errorCode: 'VALIDATION_01',
            message:
              'Excede el máximo diario de 4 horas. Ya tienes slots registrados para este día.',
          });
        }

        const overlappingSlots = await tutorHaveAvailabilityRepository
          .createQueryBuilder('tha')
          .innerJoin('tha.availability', 'a')
          .where('tha.idTutor = :tutorId', { tutorId })
          .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek: dayOfWeekNumber })
          .andWhere('a.startTime IN (:...slotTimes)', { slotTimes })
          .getCount();

        if (overlappingSlots > 0) {
          throw new ConflictException({
            errorCode: 'CONFLICT_01',
            message:
              'El rango contiene horarios que se superponen con disponibilidades existentes',
          });
        }

        const createdSlots: Array<{
          slotId: number;
          tutorId: string;
          dayOfWeek: DayOfWeek;
          startTime: string;
          endTime: string;
          modality: Modality;
          duration: number;
        }> = [];

        for (const startTime of slotTimes) {
          let availability = await availabilityRepository.findOne({
            where: { dayOfWeek: dayOfWeekNumber, startTime },
          });

          if (!availability) {
            availability = availabilityRepository.create({
              dayOfWeek: dayOfWeekNumber,
              startTime,
            });
            availability = await availabilityRepository.save(availability);
          }

          const assignment = tutorHaveAvailabilityRepository.create({
            idTutor: tutorId,
            idAvailability: availability.idAvailability,
            modality: dto.modality,
          });

          await tutorHaveAvailabilityRepository.save(assignment);

          createdSlots.push({
            slotId: availability.idAvailability,
            tutorId,
            dayOfWeek: dto.dayOfWeek,
            startTime,
            endTime: this.calculateEndTime(startTime),
            modality: dto.modality,
            duration: 0.5,
          });
        }

        return createdSlots;
      },
    );
  }

  async updateSlotsInRange(tutorId: string, dto: CreateSlotRangeDto) {
    const dayOfWeekNumber = DayOfWeekToNumber[dto.dayOfWeek];
    const slotTimes = this.buildSlotTimesFromRange(dto.startTime, dto.endTime);

    const slotsToUpdate = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoinAndSelect('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek: dayOfWeekNumber })
      .andWhere('a.startTime IN (:...slotTimes)', { slotTimes })
      .getMany();

    if (slotsToUpdate.length === 0) {
      throw new NotFoundException({
        errorCode: 'RESOURCE_02',
        message: 'No se encontraron franjas de disponibilidad para actualizar',
      });
    }

    const slotIds = slotsToUpdate.map((slot) => slot.idAvailability);

    await this.tutorHaveAvailabilityRepository
      .createQueryBuilder()
      .update(TutorHaveAvailability)
      .set({ modality: dto.modality })
      .where('id_tutor = :tutorId', { tutorId })
      .andWhere('id_availability IN (:...slotIds)', { slotIds })
      .execute();

    return slotsToUpdate.map((slot) => ({
      slotId: slot.idAvailability,
      tutorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: slot.availability.startTime,
      endTime: this.calculateEndTime(slot.availability.startTime),
      modality: dto.modality,
      duration: 0.5,
    }));
  }

  async deleteSlotsInRange(tutorId: string, dto: CreateSlotRangeDto) {
    const dayOfWeekNumber = DayOfWeekToNumber[dto.dayOfWeek];
    const slotTimes = this.buildSlotTimesFromRange(dto.startTime, dto.endTime);

    const slotsToDelete = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoinAndSelect('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek: dayOfWeekNumber })
      .andWhere('a.startTime IN (:...slotTimes)', { slotTimes })
      .getMany();

    if (slotsToDelete.length === 0) {
      throw new NotFoundException({
        errorCode: 'RESOURCE_02',
        message: 'No se encontraron franjas de disponibilidad para eliminar',
      });
    }

    await this.tutorHaveAvailabilityRepository.remove(slotsToDelete);

    return {
      deletedSlots: slotsToDelete.length,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      modality: dto.modality,
    };
  }

  async updateSlot(tutorId: string, dto: UpdateSlotDto) {
    const tutorAvailability =
      await this.tutorHaveAvailabilityRepository.findOne({
        where: { idTutor: tutorId, idAvailability: dto.slotId },
        relations: ['availability'],
      });

    if (!tutorAvailability) {
      throw new NotFoundException(
        'Franja de disponibilidad no encontrada o no pertenece al tutor',
      );
    }

    const currentAvailability = tutorAvailability.availability;
    let updatedAvailability = currentAvailability;

    if (dto.startTime && dto.startTime !== currentAvailability.startTime) {
      await this.validateNoOverlapExcluding(
        tutorId,
        currentAvailability.dayOfWeek,
        dto.startTime,
        dto.slotId,
      );

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
        newAvailability =
          await this.availabilityRepository.save(newAvailability);
      }

      const existingAssignment =
        await this.tutorHaveAvailabilityRepository.findOne({
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

      const modalityToUse = dto.modality || tutorAvailability.modality;
      await this.tutorHaveAvailabilityRepository.remove(tutorAvailability);

      const newTutorAvailability = this.tutorHaveAvailabilityRepository.create({
        idTutor: tutorId,
        idAvailability: newAvailability.idAvailability,
        modality: modalityToUse,
      });

      await this.tutorHaveAvailabilityRepository.save(newTutorAvailability);
      updatedAvailability = newAvailability;
    } else if (dto.modality && dto.modality !== tutorAvailability.modality) {
      tutorAvailability.modality = dto.modality;
      await this.tutorHaveAvailabilityRepository.save(tutorAvailability);
    }

    return {
      slotId: updatedAvailability.idAvailability,
      tutorId,
      dayOfWeek: NumberToDayOfWeek[updatedAvailability.dayOfWeek],
      startTime: updatedAvailability.startTime,
      modality: tutorAvailability.modality,
      duration: 0.5,
    };
  }

  async deleteSlot(tutorId: string, dto: DeleteSlotDto) {
    const tutorAvailability =
      await this.tutorHaveAvailabilityRepository.findOne({
        where: { idTutor: tutorId, idAvailability: dto.slotId },
      });

    if (!tutorAvailability) {
      throw new NotFoundException(
        'Franja de disponibilidad no encontrada o no pertenece al tutor',
      );
    }

    await this.tutorHaveAvailabilityRepository.remove(tutorAvailability);

    return {
      message: 'Franja de disponibilidad eliminada exitosamente',
      slotId: dto.slotId,
    };
  }

  // =====================================================
  // CONSULTA PÚBLICA PARA ESTUDIANTES
  // =====================================================

  /**
   * Obtiene la disponibilidad de un tutor marcando correctamente
   * los slots que quedan dentro del bloque de tiempo de sesiones activas.
   *
   * Un slot se marca NO disponible si:
   *   a) Su propio idAvailability tiene una sesión activa (caso exacto), O
   *   b) Cae dentro del bloque de tiempo de una sesión activa que comenzó
   *      en otro slot anterior (sesiones de 1h o 1.5h).
   *
   * La lógica trabaja en minutos del día para simplicidad y precisión.
   */
  async getTutorAvailability(
    tutorId: string,
    options?: {
      onlyAvailable?: boolean;
      onlyFuture?: boolean;
      modality?: Modality;
    },
  ): Promise<TutorAvailabilityPublic> {
    const tutorAvailabilities = await this.tutorHaveAvailabilityRepository.find(
      {
        where: { idTutor: tutorId },
        relations: ['availability', 'tutor', 'tutor.user'],
      },
    );

    if (tutorAvailabilities.length === 0) {
      throw new NotFoundException('Tutor no tiene disponibilidad configurada');
    }

    // Obtener sesiones activas del tutor con su duración real
    const occupiedRanges = await this.buildOccupiedRangesForTutor(tutorId);

    let slots: AvailabilitySlot[] = tutorAvailabilities.map((ta) => {
      const startTime = ta.availability.startTime;
      const endTime = this.calculateEndTime(startTime);

      const isOccupied = this.isSlotOccupiedByBlock(startTime, occupiedRanges);

      return {
        slotId: ta.idAvailability.toString(),
        dayOfWeek: NumberToDayOfWeek[ta.availability.dayOfWeek],
        startTime,
        endTime,
        modality: ta.modality,
        duration: 0.5,
        isAvailable: !isOccupied,
      };
    });

    if (options?.onlyAvailable) slots = slots.filter((s) => s.isAvailable);
    if (options?.modality)
      slots = slots.filter((s) => s.modality === options.modality);

    const groupedByDay = this.groupSlotsByDay(slots);

    return {
      tutorId,
      tutorName: tutorAvailabilities[0].tutor.user.name,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.isAvailable),
      groupedByDay,
    };
  }

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
    const tutorsWithAvailability = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoinAndSelect('tha.tutor', 'tutor')
      .innerJoinAndSelect('tutor.user', 'user')
      .innerJoinAndSelect('tha.availability', 'availability')
      .where('tutor.isActive = :isActive', { isActive: true })
      .andWhere('tutor.profile_completed = :completed', { completed: true })
      .getMany();

    const tutorMap = new Map<
      string,
      { tutorId: string; tutorName: string; slots: TutorHaveAvailability[] }
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

    // Obtener rangos ocupados para todos los tutores de una vez
    const allTutorIds = Array.from(tutorMap.keys());
    const occupiedRangesByTutor =
      await this.buildOccupiedRangesForTutors(allTutorIds);

    const result = Array.from(tutorMap.values()).map((tutor) => {
      const occupiedRanges = occupiedRangesByTutor.get(tutor.tutorId) ?? [];

      let slots = tutor.slots;
      if (options?.modality) {
        slots = slots.filter((s) => s.modality === options.modality);
      }

      const totalSlots = slots.length;
      const availableCount = slots.filter(
        (s) =>
          !this.isSlotOccupiedByBlock(s.availability.startTime, occupiedRanges),
      ).length;

      if (options?.onlyAvailable && availableCount === 0) return null;

      const modalities = [
        ...new Set(slots.map((s) => s.modality)),
      ] as Modality[];

      return {
        tutorId: tutor.tutorId,
        tutorName: tutor.tutorName,
        totalSlots,
        availableSlots: availableCount,
        modalities,
      };
    });

    return result.filter((r) => r !== null);
  }

  async getTutorsBySubjectWithAvailability(
    subjectId: string,
    options?: {
      onlyAvailable?: boolean;
      modality?: Modality;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    tutors: {
      tutorId: string;
      tutorName: string;
      totalSlots: number;
      availableSlots: number;
      modalities: Modality[];
      availability: TutorAvailabilityPublic;
    }[];
    total: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 10;
    const offset = (page - 1) * limit;

    // 1. IDs elegibles
    const eligibleTutorsQuery = this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .select('DISTINCT tha.id_tutor', 'tutorId')
      .innerJoin('tha.tutor', 'tutor')
      .innerJoin('tutor.tutorImpartSubjects', 'tis')
      .where('tutor.isActive = :isActive', { isActive: true })
      .andWhere('tutor.profile_completed = :completed', { completed: true })
      .andWhere('tis.idSubject = :subjectId', { subjectId });

    if (options?.modality) {
      eligibleTutorsQuery.andWhere('tha.modality = :modality', {
        modality: options.modality,
      });
    }

    const allEligibleTutors = await eligibleTutorsQuery.getRawMany<{
      tutorId: string;
    }>();
    if (allEligibleTutors.length === 0) return { tutors: [], total: 0 };

    const allEligibleIds = allEligibleTutors.map((r) => r.tutorId);

    // 2. Calcular rangos ocupados para todos los elegibles
    const occupiedRangesByTutor =
      await this.buildOccupiedRangesForTutors(allEligibleIds);

    // 3. Cargar todos sus slots para poder filtrar por disponibilidad real
    const allSlotsForEligible = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoinAndSelect('tha.availability', 'availability')
      .where('tha.id_tutor IN (:...ids)', { ids: allEligibleIds })
      .getMany();

    const slotsByTutor = new Map<string, TutorHaveAvailability[]>();
    for (const slot of allSlotsForEligible) {
      if (!slotsByTutor.has(slot.idTutor)) slotsByTutor.set(slot.idTutor, []);
      slotsByTutor.get(slot.idTutor)!.push(slot);
    }

    // 4. Filtrar onlyAvailable con la lógica de bloques
    let finalIds = allEligibleIds;

    if (options?.onlyAvailable) {
      finalIds = allEligibleIds.filter((id) => {
        const slots = slotsByTutor.get(id) ?? [];
        const occupied = occupiedRangesByTutor.get(id) ?? [];
        const hasAvailable = slots.some(
          (s) =>
            !this.isSlotOccupiedByBlock(s.availability.startTime, occupied),
        );
        return hasAvailable;
      });

      if (finalIds.length === 0) return { tutors: [], total: 0 };
    }

    const total = finalIds.length;
    const pagedIds = finalIds.slice(offset, offset + limit);
    if (pagedIds.length === 0) return { tutors: [], total };

    // 5. Cargar datos completos para la página
    const slotsQuery = this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoinAndSelect('tha.tutor', 'tutor')
      .innerJoinAndSelect('tutor.user', 'user')
      .innerJoinAndSelect('tha.availability', 'availability')
      .where('tha.id_tutor IN (:...pagedIds)', { pagedIds });

    if (options?.modality) {
      slotsQuery.andWhere('tha.modality = :modality', {
        modality: options.modality,
      });
    }

    const slots = await slotsQuery.getMany();

    const tutorMap = new Map<
      string,
      { tutorId: string; tutorName: string; slots: TutorHaveAvailability[] }
    >();

    slots.forEach((slot) => {
      if (!tutorMap.has(slot.idTutor)) {
        tutorMap.set(slot.idTutor, {
          tutorId: slot.idTutor,
          tutorName: slot.tutor.user.name,
          slots: [],
        });
      }
      tutorMap.get(slot.idTutor)!.slots.push(slot);
    });

    // 6. Construir respuesta usando la nueva lógica de bloques
    const tutors = pagedIds
      .filter((id) => tutorMap.has(id))
      .map((id) => {
        const tutor = tutorMap.get(id)!;
        const occupied = occupiedRangesByTutor.get(id) ?? [];
        const tutorSlots = tutor.slots;

        const availableSlotsArray: AvailabilitySlot[] = [];
        const groupedByDay = {} as Record<DayOfWeek, AvailabilitySlot[]>;

        tutorSlots.forEach((slot) => {
          const dayOfWeek = NumberToDayOfWeek[slot.availability.dayOfWeek];
          const startTime = slot.availability.startTime;
          const endTime = this.calculateEndTime(startTime);
          const isOccupied = this.isSlotOccupiedByBlock(startTime, occupied);

          const slotData: AvailabilitySlot = {
            slotId: slot.idAvailability.toString(),
            dayOfWeek,
            startTime,
            endTime,
            modality: slot.modality,
            duration: 0.5,
            isAvailable: !isOccupied,
          };

          if (!isOccupied) availableSlotsArray.push(slotData);
          if (!groupedByDay[dayOfWeek]) groupedByDay[dayOfWeek] = [];
          groupedByDay[dayOfWeek].push(slotData);
        });

        Object.keys(groupedByDay).forEach((day) => {
          groupedByDay[day as DayOfWeek].sort((a, b) =>
            a.startTime.localeCompare(b.startTime),
          );
        });

        const modalities = [
          ...new Set(tutorSlots.map((s) => s.modality)),
        ] as Modality[];

        return {
          tutorId: tutor.tutorId,
          tutorName: tutor.tutorName,
          totalSlots: tutorSlots.length,
          availableSlots: availableSlotsArray.length,
          modalities,
          availability: {
            tutorId: tutor.tutorId,
            tutorName: tutor.tutorName,
            totalSlots: tutorSlots.length,
            availableSlots: availableSlotsArray,
            groupedByDay,
          } as TutorAvailabilityPublic,
        };
      });

    return { tutors, total };
  }

  // =====================================================
  // MÉTODOS USADOS POR SessionValidationService
  // =====================================================

  async getAvailabilityById(availabilityId: number): Promise<Availability> {
    const availability = await this.availabilityRepository.findOne({
      where: { idAvailability: availabilityId },
    });
    if (!availability)
      throw new NotFoundException('Availability slot not found');
    return availability;
  }

  async validateModalityForSlot(
    availabilityId: number,
    tutorId: string,
    requestedModality: Modality,
  ): Promise<void> {
    const tutorAvailability =
      await this.tutorHaveAvailabilityRepository.findOne({
        where: { idAvailability: availabilityId, idTutor: tutorId },
      });

    if (!tutorAvailability) {
      throw new NotFoundException(
        'Franja de disponibilidad no encontrada para este tutor',
      );
    }

    if (tutorAvailability.modality !== requestedModality) {
      throw new BadRequestException(
        `La modalidad de la franja es ${tutorAvailability.modality}, pero solicitaste ${requestedModality}`,
      );
    }
  }

  /**
   * Versión original — verifica si un slot exacto está libre en una fecha.
   * Se mantiene para compatibilidad con el SessionValidationService existente.
   */
  async isSlotAvailableForDate(
    tutorId: string,
    availabilityId: number,
    scheduledDate: string,
  ): Promise<boolean> {
    const existing = await this.scheduledSessionRepository.findOne({
      where: {
        idTutor: tutorId,
        idAvailability: availabilityId,
        scheduledDate,
      },
      relations: ['session'],
    });

    if (!existing?.session) return true;

    const isActive = [
      SessionStatus.SCHEDULED,
      SessionStatus.PENDING_MODIFICATION,
      SessionStatus.PENDING_TUTOR_CONFIRMATION,
    ].includes(existing.session.status);

    return !isActive;
  }

  /**
   * Versión extendida — además valida que ningún slot dentro del bloque
   * de la sesión propuesta esté ocupado, y que el tutor tenga slots
   * registrados para cubrir toda la duración solicitada.
   *
   * Usado en SessionValidationService.validateAvailabilitySlot().
   *
   * @param tutorId         ID del tutor
   * @param availabilityId  Slot de inicio seleccionado por el estudiante
   * @param scheduledDate   Fecha propuesta
   * @param durationHours   Duración solicitada (0.5, 1 o 1.5)
   */
  async isSlotAvailableForDateWithDuration(
    tutorId: string,
    availabilityId: number,
    scheduledDate: string,
    durationHours: number,
    excludeSessionId?: string, // ← NUEVO
  ): Promise<{ available: boolean; reason?: string }> {
    // 1. Obtener el slot de inicio
    const startSlot = await this.availabilityRepository.findOne({
      where: { idAvailability: availabilityId },
    });

    if (!startSlot) {
      return {
        available: false,
        reason: 'El slot de disponibilidad no existe',
      };
    }

    const startMinutes = this.timeToMinutes(startSlot.startTime);
    const durationMinutes = Math.round(durationHours * 60);
    const endMinutes = startMinutes + durationMinutes;

    // 2. Verificar cobertura completa de slots del tutor
    const neededSlotCount = durationMinutes / this.SLOT_DURATION_MINUTES;

    const tutorSlotsInDay = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoin('tha.availability', 'a')
      .where('tha.id_tutor = :tutorId', { tutorId })
      .andWhere('a.day_of_week = :dayOfWeek', {
        dayOfWeek: startSlot.dayOfWeek,
      })
      .andWhere(
        `(EXTRACT(HOUR FROM a.start_time::time) * 60 + EXTRACT(MINUTE FROM a.start_time::time)) >= :startMin`,
        { startMin: startMinutes },
      )
      .andWhere(
        `(EXTRACT(HOUR FROM a.start_time::time) * 60 + EXTRACT(MINUTE FROM a.start_time::time)) < :endMin`,
        { endMin: endMinutes },
      )
      .getCount();

    if (tutorSlotsInDay < neededSlotCount) {
      return {
        available: false,
        reason: `El tutor no tiene disponibilidad registrada para cubrir ${durationHours}h desde las ${startSlot.startTime}. Solo tiene ${tutorSlotsInDay} franja(s) de las ${neededSlotCount} necesarias.`,
      };
    }

    // 3. Verificar solapamientos con sesiones activas
    const qb = this.scheduledSessionRepository
      .createQueryBuilder('ss')
      .innerJoinAndSelect('ss.session', 'session')
      .innerJoinAndSelect('ss.availability', 'availability')
      .where('ss.id_tutor = :tutorId', { tutorId })
      .andWhere('ss.scheduled_date = :scheduledDate', { scheduledDate })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
          SessionStatus.PENDING_TUTOR_CONFIRMATION,
        ],
      });

    //  CLAVE: excluir la sesión actual si aplica
    if (excludeSessionId) {
      qb.andWhere('ss.idSession != :excludeSessionId', { excludeSessionId });
    }

    const activeSessionsInDay = await qb.getMany();

    for (const ss of activeSessionsInDay) {
      const sessionStart = this.timeToMinutes(ss.availability.startTime);
      const sessionDuration = await this.getSessionDurationMinutes(
        ss.idSession,
      );
      const sessionEnd = sessionStart + sessionDuration;

      const overlaps = startMinutes < sessionEnd && endMinutes > sessionStart;

      if (overlaps) {
        return {
          available: false,
          reason: `El horario solicitado se solapa con una sesión activa de ${ss.availability.startTime} a ${this.minutesToTime(sessionEnd)}`,
        };
      }
    }

    return { available: true };
  }

  // =====================================================
  // HELPERS PRIVADOS — LÓGICA DE BLOQUES
  // =====================================================

  /**
   * Construye los rangos de minutos ocupados para un solo tutor.
   * Usado en getTutorAvailability() donde solo hay un tutor.
   */
  private async buildOccupiedRangesForTutor(
    tutorId: string,
  ): Promise<OccupiedRange[]> {
    const map = await this.buildOccupiedRangesForTutors([tutorId]);
    return map.get(tutorId) ?? [];
  }

  /**
   * Construye los rangos de minutos ocupados para múltiples tutores en una sola
   * ronda de consultas. Devuelve Map<tutorId, OccupiedRange[]>.
   *
   * Para cada sesión activa:
   *   - startMinutes = hora de inicio del slot seleccionado
   *   - endMinutes   = startMinutes + duración real de la sesión (Session.endTime - startTime)
   *
   * El cálculo usa Session.startTime y Session.endTime (la duración real agendada),
   * no el slot de 30 min de Availability. Así captura correctamente bloques de 1h o 1.5h.
   */
  private async buildOccupiedRangesForTutors(
    tutorIds: string[],
  ): Promise<Map<string, OccupiedRange[]>> {
    if (!tutorIds.length) return new Map();

    // Traer sesiones activas con su slot de inicio y los tiempos de la sesión
    const activeSessions = await this.scheduledSessionRepository
      .createQueryBuilder('ss')
      .innerJoinAndSelect('ss.session', 'session')
      .innerJoinAndSelect('ss.availability', 'availability')
      .where('ss.id_tutor IN (:...tutorIds)', { tutorIds })
      .andWhere('session.status IN (:...activeStatuses)', {
        activeStatuses: [
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
          SessionStatus.PENDING_TUTOR_CONFIRMATION,
        ],
      })
      .getMany();

    const result = new Map<string, OccupiedRange[]>();

    for (const ss of activeSessions) {
      if (!result.has(ss.idTutor)) result.set(ss.idTutor, []);

      // La duración real de la sesión viene de Session.startTime y Session.endTime
      const sessionStartMinutes = this.timeToMinutes(ss.session.startTime);
      const sessionEndMinutes = this.timeToMinutes(ss.session.endTime);

      result.get(ss.idTutor)!.push({
        startMinutes: sessionStartMinutes,
        endMinutes: sessionEndMinutes,
      });
    }

    return result;
  }

  /**
   * Determina si un slot (definido por su startTime) queda dentro de algún
   * rango ocupado. Un slot de 30 min ocupa [slotStart, slotStart + 30).
   * Hay solapamiento si el slot empieza antes de que el bloque termine
   * y termina después de que el bloque empieza.
   */
  private isSlotOccupiedByBlock(
    slotStartTime: string,
    occupiedRanges: OccupiedRange[],
  ): boolean {
    const slotStart = this.timeToMinutes(slotStartTime);
    const slotEnd = slotStart + this.SLOT_DURATION_MINUTES;

    return occupiedRanges.some(
      (range) => slotStart < range.endMinutes && slotEnd > range.startMinutes,
    );
  }

  /**
   * Obtiene la duración en minutos de una sesión a partir de su ID.
   * Solo se usa en isSlotAvailableForDateWithDuration() para validar
   * solapamientos exactos en el momento del agendamiento.
   */
  private async getSessionDurationMinutes(idSession: string): Promise<number> {
    const session = await this.sessionRepository.findOne({
      where: { idSession },
      select: ['startTime', 'endTime'],
    });

    if (!session) return this.SLOT_DURATION_MINUTES;

    return (
      this.timeToMinutes(session.endTime) -
      this.timeToMinutes(session.startTime)
    );
  }

  // =====================================================
  // HELPERS PRIVADOS — UTILIDADES
  // =====================================================

  private groupSlotsByDay(
    slots: AvailabilitySlot[],
  ): Record<DayOfWeek, AvailabilitySlot[]> {
    const grouped = slots.reduce(
      (acc, slot) => {
        if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
        acc[slot.dayOfWeek].push(slot);
        return acc;
      },
      {} as Record<DayOfWeek, AvailabilitySlot[]>,
    );

    Object.keys(grouped).forEach((day) => {
      grouped[day as DayOfWeek].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );
    });

    return grouped;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private calculateEndTime(startTime: string): string {
    const endMinutes =
      this.timeToMinutes(startTime) + this.SLOT_DURATION_MINUTES;
    return this.minutesToTime(endMinutes);
  }

  private buildSlotTimesFromRange(
    startTime: string,
    endTime: string,
  ): string[] {
    const minAllowedTime = this.timeToMinutes('06:00');
    const maxAllowedTime = this.timeToMinutes('22:00');

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes < minAllowedTime || endMinutes > maxAllowedTime) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message: 'El horario debe estar entre 06:00 y 22:00',
      });
    }

    if (startMinutes >= endMinutes) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message: 'La hora de inicio debe ser menor que la hora de fin',
      });
    }

    if (
      startMinutes % this.SLOT_DURATION_MINUTES !== 0 ||
      endMinutes % this.SLOT_DURATION_MINUTES !== 0
    ) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message:
          'La hora de inicio y fin deben estar alineadas a intervalos de 30 minutos',
      });
    }

    if ((endMinutes - startMinutes) % this.SLOT_DURATION_MINUTES !== 0) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message: 'El rango debe respetar intervalos de 30 minutos',
      });
    }

    const slotTimes: string[] = [];
    for (
      let current = startMinutes;
      current < endMinutes;
      current += this.SLOT_DURATION_MINUTES
    ) {
      slotTimes.push(this.minutesToTime(current));
    }

    if (slotTimes.length === 0) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message: 'El rango de horario no contiene slots válidos',
      });
    }

    return slotTimes;
  }

  private async validateNoOverlap(
    tutorId: string,
    dayOfWeek: number,
    startTime: string,
  ): Promise<void> {
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

  private async validateDailyHoursLimit(
    tutorId: string,
    dayOfWeek: number,
  ): Promise<void> {
    const slotsInDay = await this.tutorHaveAvailabilityRepository
      .createQueryBuilder('tha')
      .innerJoin('tha.availability', 'a')
      .where('tha.idTutor = :tutorId', { tutorId })
      .andWhere('a.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .getCount();

    if (slotsInDay >= this.MAX_SLOTS_PER_DAY) {
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
    }
  }
}
