import { ForbiddenException } from '@nestjs/common';
import { TutorsController } from './tutor.controller';
import { TutorService } from '../services/tutor.service';
import { UserRole } from '../../users/entities/user.entity';

describe('TutorsController', () => {
  let controller: TutorsController;
  let tutorService: jest.Mocked<Pick<TutorService, 'getTutorHoursStatus'>>;

  beforeEach(() => {
    tutorService = {
      getTutorHoursStatus: jest.fn(),
    };

    controller = new TutorsController(
      tutorService as unknown as TutorService,
      {} as any,
    );
  });

  describe('getTutorHoursStatus', () => {
    it('should allow ADMIN to query any tutor id', async () => {
      const tutorId = '11111111-1111-1111-1111-111111111111';
      const adminUser = {
        idUser: '22222222-2222-2222-2222-222222222222',
        role: UserRole.ADMIN,
      } as any;

      const expected = {
        tutorId,
        weeklyHoursUsed: 6,
        weeklyHoursRemaining: 2,
        usedPercentage: 75,
        remainingPercentage: 25,
        consultedAt: new Date().toISOString(),
      };

      tutorService.getTutorHoursStatus.mockResolvedValue(expected as any);

      const result = await controller.getTutorHoursStatus(adminUser, tutorId);

      expect(tutorService.getTutorHoursStatus).toHaveBeenCalledWith(tutorId);
      expect(result).toEqual(expected);
    });

    it('should allow TUTOR to query own id', async () => {
      const tutorId = '33333333-3333-3333-3333-333333333333';
      const tutorUser = {
        idUser: tutorId,
        role: UserRole.TUTOR,
      } as any;

      const expected = {
        tutorId,
        weeklyHoursUsed: 3.5,
        weeklyHoursRemaining: 4.5,
        usedPercentage: 43.75,
        remainingPercentage: 56.25,
        consultedAt: new Date().toISOString(),
      };

      tutorService.getTutorHoursStatus.mockResolvedValue(expected as any);

      const result = await controller.getTutorHoursStatus(tutorUser, tutorId);

      expect(tutorService.getTutorHoursStatus).toHaveBeenCalledWith(tutorId);
      expect(result).toEqual(expected);
    });

    it('should reject TUTOR querying a different tutor id', async () => {
      const tutorUser = {
        idUser: '44444444-4444-4444-4444-444444444444',
        role: UserRole.TUTOR,
      } as any;

      await expect(
        controller.getTutorHoursStatus(
          tutorUser,
          '55555555-5555-5555-5555-555555555555',
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getTutorHoursStatus(
          tutorUser,
          '55555555-5555-5555-5555-555555555555',
        ),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'PERMISSION_01',
          message: 'Solo puedes consultar tus propias horas',
        },
      });

      expect(tutorService.getTutorHoursStatus).not.toHaveBeenCalled();
    });
  });
});
