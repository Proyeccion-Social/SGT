import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let availabilityRepository: any;
  let tutorHaveAvailabilityRepository: any;
  let scheduledSessionRepository: any;
  let sessionRepository: any;

  const createQueryBuilderMock = () => ({
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    execute: jest.fn(),
  });

  beforeEach(() => {
    availabilityRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    tutorHaveAvailabilityRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    scheduledSessionRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    sessionRepository = {
      findOne: jest.fn(),
    };

    service = new AvailabilityService(
      availabilityRepository,
      tutorHaveAvailabilityRepository,
      scheduledSessionRepository,
      sessionRepository,
    );

    availabilityRepository.manager.transaction.mockImplementation(
      async (
        callback: (manager: {
          getRepository: (entity: unknown) => any;
        }) => Promise<unknown>,
      ) =>
        callback({
          getRepository: (entity: unknown) => {
            if ((entity as any).name === 'Availability') {
              return availabilityRepository;
            }
            return tutorHaveAvailabilityRepository;
          },
        }),
    );
  });

  describe('createSlotsInRange', () => {
    it('creates one assignment per 30-minute slot in the range', async () => {
      const firstQueryBuilder = createQueryBuilderMock();
      firstQueryBuilder.getCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(
        firstQueryBuilder,
      );

      availabilityRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      availabilityRepository.save
        .mockResolvedValueOnce({ idAvailability: 11 })
        .mockResolvedValueOnce({ idAvailability: 12 });
      tutorHaveAvailabilityRepository.save.mockResolvedValue({});

      const result = await service.createSlotsInRange('tutor-1', {
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
        modality: Modality.PRES,
      });

      expect(result).toEqual([
        {
          slotId: 11,
          tutorId: 'tutor-1',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:00',
          endTime: '08:30',
          modality: Modality.PRES,
          duration: 0.5,
        },
        {
          slotId: 12,
          tutorId: 'tutor-1',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:30',
          endTime: '09:00',
          modality: Modality.PRES,
          duration: 0.5,
        },
      ]);
      expect(tutorHaveAvailabilityRepository.save).toHaveBeenCalledTimes(2);
      expect(availabilityRepository.save).toHaveBeenCalledTimes(2);
    });

    it('throws VALIDATION_01 if range is outside allowed hours', async () => {
      await expect(
        service.createSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '05:30',
          endTime: '07:00',
          modality: Modality.PRES,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
        },
      });
    });

    it('throws VALIDATION_01 when time boundaries are not aligned to 30-minute increments', async () => {
      await expect(
        service.createSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:15',
          endTime: '09:00',
          modality: Modality.PRES,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
          message:
            'La hora de inicio y fin deben estar alineadas a intervalos de 30 minutos',
        },
      });
    });

    it('throws CONFLICT_01 when the tutor already has overlapping slots', async () => {
      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.createSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:00',
          endTime: '09:00',
          modality: Modality.PRES,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateSlotsInRange', () => {
    it('updates modality for every slot in the range', async () => {
      const selectQb = createQueryBuilderMock();
      selectQb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 21,
          modality: Modality.PRES,
          availability: { startTime: '10:00' },
        },
        {
          idTutor: 'tutor-1',
          idAvailability: 22,
          modality: Modality.PRES,
          availability: { startTime: '10:30' },
        },
      ]);
      const updateQb = createQueryBuilderMock();
      updateQb.execute.mockResolvedValue({ affected: 2 });
      tutorHaveAvailabilityRepository.createQueryBuilder
        .mockReturnValueOnce(selectQb)
        .mockReturnValueOnce(updateQb);

      const result = await service.updateSlotsInRange('tutor-1', {
        dayOfWeek: DayOfWeek.TUESDAY,
        startTime: '10:00',
        endTime: '11:00',
        modality: Modality.VIRT,
      });

      expect(updateQb.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          slotId: 21,
          tutorId: 'tutor-1',
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '10:30',
          modality: Modality.VIRT,
          duration: 0.5,
        },
        {
          slotId: 22,
          tutorId: 'tutor-1',
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '10:30',
          endTime: '11:00',
          modality: Modality.VIRT,
          duration: 0.5,
        },
      ]);
    });

    it('throws VALIDATION_01 if update range is outside allowed hours', async () => {
      await expect(
        service.updateSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '05:30',
          endTime: '07:00',
          modality: Modality.VIRT,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
        },
      });
    });

    it('throws RESOURCE_02 if no slots are found in the range', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.updateSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '11:00',
          modality: Modality.VIRT,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'RESOURCE_02',
        },
      });
    });
  });

  describe('deleteSlotsInRange', () => {
    it('removes every slot inside the range and returns deleted count', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 31,
          modality: Modality.PRES,
          availability: { startTime: '14:00' },
        },
        {
          idTutor: 'tutor-1',
          idAvailability: 32,
          modality: Modality.PRES,
          availability: { startTime: '14:30' },
        },
      ]);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      tutorHaveAvailabilityRepository.remove.mockResolvedValue({});

      const result = await service.deleteSlotsInRange('tutor-1', {
        dayOfWeek: DayOfWeek.WEDNESDAY,
        startTime: '14:00',
        endTime: '15:00',
        modality: Modality.PRES,
      });

      expect(tutorHaveAvailabilityRepository.remove).toHaveBeenCalledWith([
        expect.objectContaining({ idAvailability: 31 }),
        expect.objectContaining({ idAvailability: 32 }),
      ]);
      expect(result).toEqual({
        deletedSlots: 2,
        dayOfWeek: DayOfWeek.WEDNESDAY,
        startTime: '14:00',
        endTime: '15:00',
        modality: Modality.PRES,
      });
    });

    it('throws RESOURCE_02 if there are no slots to delete', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.deleteSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.WEDNESDAY,
          startTime: '14:00',
          endTime: '15:00',
          modality: Modality.PRES,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'RESOURCE_02',
        },
      });
    });
  });

  describe('createSlot', () => {
    it('creates a single availability slot for a tutor', async () => {
      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValue(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      availabilityRepository.findOne.mockResolvedValue(null);
      availabilityRepository.save.mockResolvedValue({
        idAvailability: 1,
        dayOfWeek: 0,
        startTime: '08:00',
      });
      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(null);

      const result = await service.createSlot('tutor-1', {
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        modality: Modality.PRES,
      });

      expect(result).toEqual({
        slotId: 1,
        tutorId: 'tutor-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '08:00',
        modality: Modality.PRES,
        duration: 0.5,
      });
      expect(availabilityRepository.save).toHaveBeenCalled();
      expect(tutorHaveAvailabilityRepository.save).toHaveBeenCalled();
    });

    it('throws ConflictException when tutor already has that slot assigned', async () => {
      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValue(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 1,
        dayOfWeek: 0,
        startTime: '08:00',
      });
      tutorHaveAvailabilityRepository.findOne.mockResolvedValue({
        idTutor: 'tutor-1',
        idAvailability: 1,
      });

      await expect(
        service.createSlot('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:00',
          modality: Modality.PRES,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateSlot', () => {
    it('updates the startTime of an existing slot', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 5,
        modality: Modality.PRES,
        availability: { dayOfWeek: 0, startTime: '08:00', idAvailability: 5 },
      };

      tutorHaveAvailabilityRepository.findOne
        .mockResolvedValueOnce(tutorAvailability)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ idAvailability: 6, idTutor: 'tutor-1' });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValue(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      availabilityRepository.findOne.mockResolvedValue(null);
      availabilityRepository.save.mockResolvedValue({
        idAvailability: 6,
        dayOfWeek: 0,
        startTime: '09:00',
      });

      const result = await service.updateSlot('tutor-1', {
        slotId: 5,
        startTime: '09:00',
      });

      expect(result).toEqual(
        expect.objectContaining({
          slotId: 6,
          tutorId: 'tutor-1',
          startTime: '09:00',
        }),
      );
      expect(tutorHaveAvailabilityRepository.remove).toHaveBeenCalledWith(
        tutorAvailability,
      );
    });

    it('updates only the modality if startTime is not provided', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 5,
        modality: Modality.PRES,
        availability: { dayOfWeek: 0, startTime: '08:00', idAvailability: 5 },
      };

      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(
        tutorAvailability,
      );

      const result = await service.updateSlot('tutor-1', {
        slotId: 5,
        modality: Modality.VIRT,
      });

      expect(result).toEqual(
        expect.objectContaining({
          slotId: 5,
          modality: Modality.VIRT,
        }),
      );
      expect(tutorHaveAvailabilityRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ modality: Modality.VIRT }),
      );
    });

    it('throws NotFoundException if slot does not belong to tutor', async () => {
      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSlot('tutor-1', {
          slotId: 999,
          modality: Modality.VIRT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException if new time slot already assigned to tutor', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 5,
        modality: Modality.PRES,
        availability: { dayOfWeek: 0, startTime: '08:00', idAvailability: 5 },
      };

      // First findOne: returns existing tutor availability for the slot being updated
      tutorHaveAvailabilityRepository.findOne
        .mockResolvedValueOnce(tutorAvailability)
        // Third findOne: returns conflicting assignment at new time
        .mockResolvedValueOnce({ idAvailability: 6, idTutor: 'tutor-1' });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValue(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      // Second findOne: availabilityRepository finds the availability at new time
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 6,
        dayOfWeek: 0,
        startTime: '09:00',
      });

      await expect(
        service.updateSlot('tutor-1', {
          slotId: 5,
          startTime: '09:00',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteSlot', () => {
    it('deletes an availability slot', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 5,
        modality: Modality.PRES,
      };

      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(
        tutorAvailability,
      );
      tutorHaveAvailabilityRepository.remove.mockResolvedValue({});

      const result = await service.deleteSlot('tutor-1', { slotId: 5 });

      expect(result).toEqual({
        message: 'Franja de disponibilidad eliminada exitosamente',
        slotId: 5,
      });
      expect(tutorHaveAvailabilityRepository.remove).toHaveBeenCalledWith(
        tutorAvailability,
      );
    });

    it('throws NotFoundException if slot does not belong to tutor', async () => {
      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteSlot('tutor-1', { slotId: 999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getTutorAvailability', () => {
    it('returns availability slots with correct isAvailable status when no sessions are scheduled', async () => {
      const tutorAvailabilities = [
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: {
            idAvailability: 10,
            dayOfWeek: 0,
            startTime: '08:00',
          },
          tutor: { user: { name: 'John Tutor' } },
        },
        {
          idTutor: 'tutor-1',
          idAvailability: 11,
          modality: Modality.PRES,
          availability: {
            idAvailability: 11,
            dayOfWeek: 0,
            startTime: '08:30',
          },
          tutor: { user: { name: 'John Tutor' } },
        },
      ];

      tutorHaveAvailabilityRepository.find.mockResolvedValue(
        tutorAvailabilities,
      );

      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTutorAvailability('tutor-1');

      expect(result).toEqual(
        expect.objectContaining({
          tutorId: 'tutor-1',
          tutorName: 'John Tutor',
          totalSlots: 2,
          availableSlots: expect.arrayContaining([
            expect.objectContaining({
              slotId: '10',
              startTime: '08:00',
              isAvailable: true,
            }),
            expect.objectContaining({
              slotId: '11',
              startTime: '08:30',
              isAvailable: true,
            }),
          ]),
        }),
      );
    });

    it('marks slots as unavailable when they have active sessions', async () => {
      const tutorAvailabilities = [
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: {
            idAvailability: 10,
            dayOfWeek: 0,
            startTime: '08:00',
          },
          tutor: { user: { name: 'John Tutor' } },
        },
      ];

      tutorHaveAvailabilityRepository.find.mockResolvedValue(
        tutorAvailabilities,
      );

      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          availability: { dayOfWeek: 0, startTime: '08:00' },
          session: { startTime: '08:00', endTime: '08:30' },
        },
      ]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTutorAvailability('tutor-1');

      expect(result.availableSlots).toHaveLength(0);
      expect(result.totalSlots).toBe(1);
    });

    it('filters slots by onlyAvailable option', async () => {
      const tutorAvailabilities = [
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: {
            idAvailability: 10,
            dayOfWeek: 0,
            startTime: '08:00',
          },
          tutor: { user: { name: 'John Tutor' } },
        },
        {
          idTutor: 'tutor-1',
          idAvailability: 11,
          modality: Modality.PRES,
          availability: {
            idAvailability: 11,
            dayOfWeek: 0,
            startTime: '08:30',
          },
          tutor: { user: { name: 'John Tutor' } },
        },
      ];

      tutorHaveAvailabilityRepository.find.mockResolvedValue(
        tutorAvailabilities,
      );

      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTutorAvailability('tutor-1', {
        onlyAvailable: true,
      });

      expect(result.availableSlots).toHaveLength(2);
    });

    it('throws NotFoundException if tutor has no availability configured', async () => {
      tutorHaveAvailabilityRepository.find.mockResolvedValue([]);

      await expect(
        service.getTutorAvailability('tutor-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getAvailabilityById', () => {
    it('returns availability slot by id', async () => {
      const availability = {
        idAvailability: 5,
        dayOfWeek: 0,
        startTime: '08:00',
      };

      availabilityRepository.findOne.mockResolvedValue(availability);

      const result = await service.getAvailabilityById(5);

      expect(result).toEqual(availability);
    });

    it('throws NotFoundException if availability does not exist', async () => {
      availabilityRepository.findOne.mockResolvedValue(null);

      await expect(service.getAvailabilityById(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('validateModalityForSlot', () => {
    it('validates that slot modality matches requested modality', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 10,
        modality: Modality.PRES,
      };

      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(
        tutorAvailability,
      );

      await expect(
        service.validateModalityForSlot(10, 'tutor-1', Modality.PRES),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException if modality does not match', async () => {
      const tutorAvailability = {
        idTutor: 'tutor-1',
        idAvailability: 10,
        modality: Modality.PRES,
      };

      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(
        tutorAvailability,
      );

      await expect(
        service.validateModalityForSlot(10, 'tutor-1', Modality.VIRT),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException if slot does not belong to tutor', async () => {
      tutorHaveAvailabilityRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateModalityForSlot(10, 'tutor-1', Modality.PRES),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('isSlotAvailableForDate', () => {
    it('returns true if slot has no active session on that date', async () => {
      scheduledSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.isSlotAvailableForDate(
        'tutor-1',
        10,
        '2024-01-15',
      );

      expect(result).toBe(true);
    });

    it('returns true if slot has an inactive session on that date', async () => {
      const scheduledSession = {
        idTutor: 'tutor-1',
        idAvailability: 10,
        scheduledDate: '2024-01-15',
        session: { status: 'CANCELLED' },
      };

      scheduledSessionRepository.findOne.mockResolvedValue(scheduledSession);

      const result = await service.isSlotAvailableForDate(
        'tutor-1',
        10,
        '2024-01-15',
      );

      expect(result).toBe(true);
    });

    it('returns false if slot has an active SCHEDULED session', async () => {
      const scheduledSession = {
        idTutor: 'tutor-1',
        idAvailability: 10,
        scheduledDate: '2024-01-15',
        session: { status: 'SCHEDULED' },
      };

      scheduledSessionRepository.findOne.mockResolvedValue(scheduledSession);

      const result = await service.isSlotAvailableForDate(
        'tutor-1',
        10,
        '2024-01-15',
      );

      expect(result).toBe(false);
    });
  });

  describe('isSlotAvailableForDateWithDuration', () => {
    it('returns available: true if slot and duration coverage are valid', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0,
        startTime: '08:00',
      });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValueOnce(2); // 2 slots needed for 1 hour
      qb.getMany.mockResolvedValue([]); // No overlapping sessions

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.isSlotAvailableForDateWithDuration(
        'tutor-1',
        10,
        '2024-01-15',
        1,
      );

      expect(result).toEqual({ available: true });
    });

    it('returns available: false if tutor lacks sufficient slots for duration', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0,
        startTime: '08:00',
      });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValueOnce(1); // Only 1 slot, but 2 needed for 1 hour

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.isSlotAvailableForDateWithDuration(
        'tutor-1',
        10,
        '2024-01-15',
        1,
      );

      expect(result.available).toBe(false);
      expect(result.reason).toContain('no tiene disponibilidad registrada');
    });

    it('returns available: false if there is a session overlap', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0,
        startTime: '08:00',
      });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValueOnce(2); // Slots coverage is OK
      qb.getMany.mockResolvedValue([
        {
          idSession: 'session-1',
          idTutor: 'tutor-1',
          availability: { startTime: '08:00' },
          session: { startTime: '08:00', endTime: '09:00' },
        },
      ]); // Overlapping session

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);
      sessionRepository.findOne.mockResolvedValue(null);

      const result = await service.isSlotAvailableForDateWithDuration(
        'tutor-1',
        10,
        '2024-01-15',
        1,
      );

      expect(result.available).toBe(false);
      expect(result.reason).toContain('se solapa con una sesión activa');
    });

    it('excludes specified session when checking for overlaps', async () => {
      availabilityRepository.findOne.mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0,
        startTime: '08:00',
      });

      const qb = createQueryBuilderMock();
      qb.getCount.mockResolvedValueOnce(2);
      qb.getMany.mockResolvedValue([]); // Query builder configured to exclude session

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.isSlotAvailableForDateWithDuration(
        'tutor-1',
        10,
        '2024-01-15',
        1,
        'session-to-exclude',
      );

      expect(result.available).toBe(true);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'ss.idSession != :excludeSessionId',
        { excludeSessionId: 'session-to-exclude' },
      );
    });
  });

  describe('getAllAvailableTutors', () => {
    it('returns all tutors with their availability slots', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: { dayOfWeek: 0, startTime: '08:00' },
          tutor: {
            isActive: true,
            profile_completed: true,
            user: { name: 'John Tutor' },
          },
        },
        {
          idTutor: 'tutor-1',
          idAvailability: 11,
          modality: Modality.PRES,
          availability: { dayOfWeek: 0, startTime: '08:30' },
          tutor: {
            isActive: true,
            profile_completed: true,
            user: { name: 'John Tutor' },
          },
        },
      ]);

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result = await service.getAllAvailableTutors();

      expect(result).toEqual([
        expect.objectContaining({
          tutorId: 'tutor-1',
          tutorName: 'John Tutor',
          totalSlots: 2,
          availableSlots: 2,
        }),
      ]);
    });

    it('filters tutors by modality', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: { dayOfWeek: 0, startTime: '08:00' },
          tutor: {
            isActive: true,
            profile_completed: true,
            user: { name: 'John Tutor' },
          },
        },
      ]);

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result = await service.getAllAvailableTutors({
        modality: Modality.PRES,
      });

      expect(result).toHaveLength(1);
      expect(result[0].modalities).toContain(Modality.PRES);
    });

    it('filters to only available tutors with onlyAvailable option', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: { dayOfWeek: 0, startTime: '08:00' },
          tutor: {
            isActive: true,
            profile_completed: true,
            user: { name: 'John Tutor' },
          },
        },
        {
          idTutor: 'tutor-2',
          idAvailability: 20,
          modality: Modality.VIRT,
          availability: { dayOfWeek: 0, startTime: '09:00' },
          tutor: {
            isActive: true,
            profile_completed: true,
            user: { name: 'Jane Tutor' },
          },
        },
      ]);

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany
        .mockResolvedValueOnce([
          {
            idTutor: 'tutor-1',
            idAvailability: 10,
            availability: { dayOfWeek: 0, startTime: '08:00' },
            session: { startTime: '08:00', endTime: '08:30' },
          },
        ]) // tutor-1 has occupied slot
        .mockResolvedValueOnce([]); // tutor-2 has available slots

      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result = await service.getAllAvailableTutors({
        onlyAvailable: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].tutorId).toBe('tutor-2');
    });
  });

  describe('getTutorsBySubjectWithAvailability', () => {
    it('returns tutors with subject expertise and their availability', async () => {
      const eligibleQb = createQueryBuilderMock();
      eligibleQb.getRawMany.mockResolvedValue([
        { tutorId: 'tutor-1' },
        { tutorId: 'tutor-2' },
      ]);

      const slotsQb = createQueryBuilderMock();
      slotsQb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: {
            dayOfWeek: 0,
            startTime: '08:00',
            idAvailability: 10,
          },
          tutor: { user: { name: 'John Tutor' } },
        },
      ]);

      tutorHaveAvailabilityRepository.createQueryBuilder
        .mockReturnValueOnce(eligibleQb)
        .mockReturnValueOnce(slotsQb)
        .mockReturnValueOnce(slotsQb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result =
        await service.getTutorsBySubjectWithAvailability('subject-1');

      expect(result).toEqual(
        expect.objectContaining({
          tutors: expect.arrayContaining([
            expect.objectContaining({
              tutorId: 'tutor-1',
              tutorName: 'John Tutor',
            }),
          ]),
          total: expect.any(Number),
          weekReference: expect.any(String),
        }),
      );
    });

    it('supports pagination with page and limit options', async () => {
      const eligibleQb = createQueryBuilderMock();
      eligibleQb.getRawMany.mockResolvedValue([
        { tutorId: 'tutor-1' },
        { tutorId: 'tutor-2' },
        { tutorId: 'tutor-3' },
      ]);

      const slotsQb = createQueryBuilderMock();
      slotsQb.getMany.mockResolvedValue([]);

      tutorHaveAvailabilityRepository.createQueryBuilder
        .mockReturnValueOnce(eligibleQb)
        .mockReturnValueOnce(slotsQb)
        .mockReturnValueOnce(slotsQb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result = await service.getTutorsBySubjectWithAvailability(
        'subject-1',
        { page: 1, limit: 2 },
      );

      expect(result.total).toBe(3);
      expect(result.tutors).toHaveLength(0); // No slots to show for second query
    });

    it('returns empty result if no eligible tutors found', async () => {
      const eligibleQb = createQueryBuilderMock();
      eligibleQb.getRawMany.mockResolvedValue([]);

      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(
        eligibleQb,
      );

      const result =
        await service.getTutorsBySubjectWithAvailability('subject-999');

      expect(result).toEqual({
        tutors: [],
        total: 0,
        weekReference: expect.any(String),
      });
    });

    it('filters tutors by modality if provided', async () => {
      const eligibleQb = createQueryBuilderMock();
      eligibleQb.getRawMany.mockResolvedValue([{ tutorId: 'tutor-1' }]);

      const slotsQb = createQueryBuilderMock();
      slotsQb.getMany.mockResolvedValue([
        {
          idTutor: 'tutor-1',
          idAvailability: 10,
          modality: Modality.PRES,
          availability: { dayOfWeek: 0, startTime: '08:00' },
          tutor: { user: { name: 'John Tutor' } },
        },
      ]);

      tutorHaveAvailabilityRepository.createQueryBuilder
        .mockReturnValueOnce(eligibleQb)
        .mockReturnValueOnce(slotsQb)
        .mockReturnValueOnce(slotsQb);

      const scheduledQb = createQueryBuilderMock();
      scheduledQb.getMany.mockResolvedValue([]);
      scheduledSessionRepository.createQueryBuilder.mockReturnValue(
        scheduledQb,
      );

      const result = await service.getTutorsBySubjectWithAvailability(
        'subject-1',
        { modality: Modality.PRES },
      );

      expect(result.tutors[0]?.modalities).toContain(Modality.PRES);
    });
  });
});
