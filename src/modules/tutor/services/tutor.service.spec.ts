import { NotFoundException } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';

describe('TutorService', () => {
  let service: TutorService;
  let tutorRepository: { findOne: jest.Mock };
  let sessionRepository: { find: jest.Mock };

  beforeEach(() => {
    tutorRepository = {
      findOne: jest.fn(),
    };

    sessionRepository = {
      find: jest.fn(),
    };

    service = new TutorService(
      tutorRepository as any,
      sessionRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('getTutorHoursStatus', () => {
    it('should throw RESOURCE_02 when tutor does not exist', async () => {
      tutorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getTutorHoursStatus('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getTutorHoursStatus('11111111-1111-1111-1111-111111111111'),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'RESOURCE_02',
          message: 'Tutor no encontrado',
        },
      });
    });

    it('should compute weekly used/remaining hours and percentages using tutor limit', async () => {
      tutorRepository.findOne.mockResolvedValue({
        idUser: 'tutor-1',
        limitDisponibility: 10,
      });

      sessionRepository.find.mockResolvedValue([
        {
          startTime: '08:00:00',
          endTime: '10:00:00',
          status: SessionStatus.SCHEDULED,
        },
        {
          startTime: '14:30:00',
          endTime: '16:00:00',
          status: SessionStatus.PENDING_MODIFICATION,
        },
      ]);

      const result = await service.getTutorHoursStatus('tutor-1');

      expect(result.tutorId).toBe('tutor-1');
      expect(result.weeklyHoursUsed).toBe(3.5);
      expect(result.weeklyHoursRemaining).toBe(6.5);
      expect(result.usedPercentage).toBe(35);
      expect(result.remainingPercentage).toBe(65);
      expect(new Date(result.consultedAt).toString()).not.toBe('Invalid Date');
    });

    it('should default weekly limit to 8 when tutor limit is null', async () => {
      tutorRepository.findOne.mockResolvedValue({
        idUser: 'tutor-2',
        limitDisponibility: null,
      });

      sessionRepository.find.mockResolvedValue([
        {
          startTime: '09:00:00',
          endTime: '11:00:00',
          status: SessionStatus.SCHEDULED,
        },
      ]);

      const result = await service.getTutorHoursStatus('tutor-2');

      expect(result.weeklyHoursUsed).toBe(2);
      expect(result.weeklyHoursRemaining).toBe(6);
      expect(result.usedPercentage).toBe(25);
      expect(result.remainingPercentage).toBe(75);
    });

    it('should clamp remaining hours to zero when used exceeds limit', async () => {
      tutorRepository.findOne.mockResolvedValue({
        idUser: 'tutor-3',
        limitDisponibility: 2,
      });

      sessionRepository.find.mockResolvedValue([
        {
          startTime: '08:00:00',
          endTime: '11:00:00',
          status: SessionStatus.SCHEDULED,
        },
      ]);

      const result = await service.getTutorHoursStatus('tutor-3');

      expect(result.weeklyHoursUsed).toBe(3);
      expect(result.weeklyHoursRemaining).toBe(0);
      expect(result.usedPercentage).toBe(150);
      expect(result.remainingPercentage).toBe(0);
    });

    it('should return zero percentages when weekly limit is zero', async () => {
      tutorRepository.findOne.mockResolvedValue({
        idUser: 'tutor-4',
        limitDisponibility: 0,
      });

      sessionRepository.find.mockResolvedValue([
        {
          startTime: '08:00:00',
          endTime: '09:00:00',
          status: SessionStatus.SCHEDULED,
        },
      ]);

      const result = await service.getTutorHoursStatus('tutor-4');

      expect(result.weeklyHoursUsed).toBe(1);
      expect(result.weeklyHoursRemaining).toBe(0);
      expect(result.usedPercentage).toBe(0);
      expect(result.remainingPercentage).toBe(0);
    });

    it('should query only scheduled and pending-modification sessions for current week', async () => {
      tutorRepository.findOne.mockResolvedValue({
        idUser: 'tutor-5',
        limitDisponibility: 8,
      });
      sessionRepository.find.mockResolvedValue([]);

      await service.getTutorHoursStatus('tutor-5');

      const findCallArg = sessionRepository.find.mock.calls[0][0];

      expect(findCallArg.where.idTutor).toBe('tutor-5');
      expect(findCallArg.where.scheduledDate).toBeDefined();
      expect(findCallArg.where.status).toBeDefined();
      expect(findCallArg.where.status._value).toEqual([
        SessionStatus.SCHEDULED,
        SessionStatus.PENDING_MODIFICATION,
      ]);
    });
  });
});
