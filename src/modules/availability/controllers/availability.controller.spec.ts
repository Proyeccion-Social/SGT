import { AvailabilityController } from './availability.controller';
import { TutorService } from 'src/modules/tutor/services/tutor.service';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let tutorService: jest.Mocked<Pick<TutorService, 'updateWeeklyHoursLimit'>>;

  beforeEach(() => {
    tutorService = {
      updateWeeklyHoursLimit: jest.fn(),
    };

    controller = new AvailabilityController(
      {} as any,
      tutorService as unknown as TutorService,
      {} as any,
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
});
