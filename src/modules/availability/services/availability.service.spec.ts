import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
      async (callback: (manager: { getRepository: (entity: unknown) => any }) => Promise<unknown>) =>
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
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(firstQueryBuilder);

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

    it('throws CONFLICT_01 when the tutor already has overlapping slots', async () => {
      const qb = createQueryBuilderMock();
      qb.getCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
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

    it('throws VALIDATION_01 when the daily slot limit is exceeded', async () => {
      const qb = createQueryBuilderMock();
      qb.getCount
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(0);
      tutorHaveAvailabilityRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.createSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:00',
          endTime: '09:00',
          modality: Modality.PRES,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
        },
      });
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

    it('throws VALIDATION_01 when delete range is not in 30-minute increments', async () => {
      await expect(
        service.deleteSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.WEDNESDAY,
          startTime: '14:15',
          endTime: '15:00',
          modality: Modality.PRES,
        }),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
        },
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

  describe('createSlotTimes validation helper behavior via public methods', () => {
    it('throws VALIDATION_01 when the range is not in 30-minute increments', async () => {
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
        },
      });
    });

    it('throws VALIDATION_01 when start and end are not aligned to :00/:30 boundaries', async () => {
      await expect(
        service.createSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:15',
          endTime: '09:15',
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

    it('throws VALIDATION_01 when only endTime is not aligned to :00/:30 boundaries', async () => {
      await expect(
        service.updateSlotsInRange('tutor-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '08:00',
          endTime: '09:15',
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
  });
});
