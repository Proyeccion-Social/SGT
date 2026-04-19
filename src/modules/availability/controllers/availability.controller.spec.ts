import { BadRequestException, HttpStatus } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { UserRole } from '../../users/entities/user.entity';
import { SlotAction } from '../enums/slot-action.enum';
import { TutorService } from 'src/modules/tutor/services/tutor.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let subjectsService: any;
  let tutorService: jest.Mocked<
    Pick<TutorService, 'findByUserId' | 'updateWeeklyHoursLimit'>
  >;
  let availabilityService: any;

  beforeEach(() => {
    subjectsService = {};
    tutorService = {
      findByUserId: jest.fn(),
      updateWeeklyHoursLimit: jest.fn(),
    };
    availabilityService = {
      createSlotsInRange: jest.fn(),
      updateSlotsInRange: jest.fn(),
      deleteSlotsInRange: jest.fn(),
      getTutorAvailability: jest.fn(),
      getTutorsBySubjectWithAvailability: jest.fn(),
      createSlot: jest.fn(),
      updateSlot: jest.fn(),
      deleteSlot: jest.fn(),
    };

    controller = new AvailabilityController(
      subjectsService,
      tutorService as unknown as TutorService,
      availabilityService,
    );
  });

  describe('updateMyWeeklyHoursLimit', () => {
    it('should update authenticated tutor weekly limit using body maxWeeklyHours', async () => {
      const user = {
        idUser: '11111111-1111-1111-1111-111111111111',
      } as any;
      const dto = { maxWeeklyHours: 8 };

      const expected = {
        tutorId: user.idUser,
        previousMaxWeeklyHours: 6,
        maxWeeklyHours: 8,
        updatedAt: new Date().toISOString(),
      };

      tutorService.updateWeeklyHoursLimit.mockResolvedValue(expected as any);

      const result = await controller.updateMyWeeklyHoursLimit(user, dto);

      expect(tutorService.updateWeeklyHoursLimit).toHaveBeenCalledWith(
        user.idUser,
        8,
      );
      expect(result).toEqual(expected);
    });

    it('should propagate service errors', async () => {
      const user = {
        idUser: '22222222-2222-2222-2222-222222222222',
      } as any;
      const dto = { maxWeeklyHours: 0 };

      const serviceError = new Error('validation failed');
      tutorService.updateWeeklyHoursLimit.mockRejectedValue(serviceError);

      await expect(
        controller.updateMyWeeklyHoursLimit(user, dto),
      ).rejects.toThrow('validation failed');
    });
  });

  describe('createSlotsInRange', () => {
    it('delegates to availabilityService using authenticated tutor id', async () => {
      const user = { idUser: 'tutor-1', role: UserRole.TUTOR } as any;
      const dto = {
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        modality: 'PRES',
      } as any;
      const slots = [{ slotId: 1 }];
      availabilityService.createSlotsInRange.mockResolvedValue(slots);

      const result = await controller.createSlotsInRange(user, dto);

      expect(availabilityService.createSlotsInRange).toHaveBeenCalledWith(
        'tutor-1',
        dto,
      );
      expect(result).toEqual({
        statusCode: HttpStatus.CREATED,
        message: 'Franjas de disponibilidad creadas exitosamente',
        slots,
      });
    });
  });

  describe('updateSlotsInRange', () => {
    it('delegates update to availabilityService using authenticated tutor id', async () => {
      const user = { idUser: 'tutor-2', role: UserRole.TUTOR } as any;
      const dto = {
        dayOfWeek: 'TUESDAY',
        startTime: '09:00',
        endTime: '11:00',
        modality: 'VIRT',
      } as any;
      const slots = [{ slotId: 10 }];
      availabilityService.updateSlotsInRange.mockResolvedValue(slots);

      const result = await controller.updateSlotsInRange(user, dto);

      expect(availabilityService.updateSlotsInRange).toHaveBeenCalledWith(
        'tutor-2',
        dto,
      );
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Franjas de disponibilidad actualizadas exitosamente',
        slots,
      });
    });
  });

  describe('deleteSlotsInRange', () => {
    it('delegates delete to availabilityService using authenticated tutor id', async () => {
      const user = { idUser: 'tutor-3', role: UserRole.TUTOR } as any;
      const dto = {
        dayOfWeek: 'WEDNESDAY',
        startTime: '13:00',
        endTime: '14:00',
        modality: 'PRES',
      } as any;
      const serviceResult = { deletedSlots: 2 };
      availabilityService.deleteSlotsInRange.mockResolvedValue(serviceResult);

      const result = await controller.deleteSlotsInRange(user, dto);

      expect(availabilityService.deleteSlotsInRange).toHaveBeenCalledWith(
        'tutor-3',
        dto,
      );
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Franjas de disponibilidad eliminadas exitosamente',
        ...serviceResult,
      });
    });
  });

  describe('manageSlot', () => {
    it('keeps existing CREATE branch working', async () => {
      const user = { idUser: 'tutor-4', role: UserRole.TUTOR } as any;
      const dto = {
        action: SlotAction.CREATE,
        data: {
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          modality: 'PRES',
        },
      } as any;
      availabilityService.createSlot.mockResolvedValue({ slotId: 1 });

      const result = await controller.manageSlot(user, dto);

      expect(availabilityService.createSlot).toHaveBeenCalledWith(
        'tutor-4',
        dto.data,
      );
      expect(result).toEqual({
        statusCode: HttpStatus.CREATED,
        message: 'Franja de disponibilidad creada exitosamente',
        slot: { slotId: 1 },
      });
    });

    it('throws when a tutor tries to manage a slot without required data', async () => {
      const user = { idUser: 'tutor-4', role: UserRole.TUTOR } as any;

      await expect(
        controller.manageSlot(user, {
          action: SlotAction.CREATE,
          data: {},
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns tutor availability for the authenticated tutor profile', async () => {
      const user = { idUser: 'tutor-5', role: UserRole.TUTOR } as any;
      const tutor = { idUser: 'tutor-5' } as any;

      tutorService.findByUserId.mockResolvedValue(tutor);
      availabilityService.getTutorAvailability.mockResolvedValue({
        tutorId: 'tutor-5',
      });

      const result = await controller.getMyAvailability(user, {} as any);

      expect(tutorService.findByUserId).toHaveBeenCalledWith('tutor-5');
      expect(availabilityService.getTutorAvailability).toHaveBeenCalledWith(
        'tutor-5',
        {},
      );
      expect(result).toEqual({ tutorId: 'tutor-5' });
    });
  });
});
