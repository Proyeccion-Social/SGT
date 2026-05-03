import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';

describe('TutorService', () => {
  let service: TutorService;
  let tutorRepository: { findOne: jest.Mock; save: jest.Mock };
  let sessionRepository: { find: jest.Mock };
  let cloudinaryService: { generateUploadSignature: jest.Mock };

  beforeEach(() => {
    tutorRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    sessionRepository = {
      find: jest.fn(),
    };

    cloudinaryService = {
      generateUploadSignature: jest.fn(),
    };

    service = new TutorService(
      tutorRepository as any,
      sessionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      cloudinaryService as any,
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

  describe('updateWeeklyHoursLimit', () => {
    it('should throw VALIDATION_01 when maxWeeklyHours is out of allowed range', async () => {
      await expect(
        service.updateWeeklyHoursLimit(
          '11111111-1111-1111-1111-111111111111',
          9,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateWeeklyHoursLimit(
          '11111111-1111-1111-1111-111111111111',
          9,
        ),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'VALIDATION_01',
          message: 'El límite semanal debe estar entre 1 y 8 horas',
        },
      });

      expect(tutorRepository.findOne).not.toHaveBeenCalled();
      expect(tutorRepository.save).not.toHaveBeenCalled();
    });

    it('should throw RESOURCE_02 when tutor does not exist', async () => {
      tutorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateWeeklyHoursLimit(
          '22222222-2222-2222-2222-222222222222',
          6,
        ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateWeeklyHoursLimit(
          '22222222-2222-2222-2222-222222222222',
          6,
        ),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'RESOURCE_02',
          message: 'Tutor no encontrado',
        },
      });

      expect(tutorRepository.save).not.toHaveBeenCalled();
    });

    it('should persist and return weekly hours update payload', async () => {
      const tutorEntity = {
        idUser: '33333333-3333-3333-3333-333333333333',
        limitDisponibility: 4,
      };

      tutorRepository.findOne.mockResolvedValue(tutorEntity);
      tutorRepository.save.mockResolvedValue({
        ...tutorEntity,
        limitDisponibility: 7,
      });

      const result = await service.updateWeeklyHoursLimit(
        '33333333-3333-3333-3333-333333333333',
        7,
      );

      expect(tutorRepository.findOne).toHaveBeenCalledWith({
        where: { idUser: '33333333-3333-3333-3333-333333333333' },
      });
      expect(tutorRepository.save).toHaveBeenCalledWith({
        ...tutorEntity,
        limitDisponibility: 7,
      });
      expect(result.tutorId).toBe('33333333-3333-3333-3333-333333333333');
      expect(result.previousMaxWeeklyHours).toBe(4);
      expect(result.maxWeeklyHours).toBe(7);
      expect(new Date(result.updatedAt).toString()).not.toBe('Invalid Date');
    });
  });

  describe('avatar flow', () => {
    it('should generate avatar upload signature for an existing tutor', async () => {
      tutorRepository.findOne.mockResolvedValue({ idUser: 'tutor-1' });
      cloudinaryService.generateUploadSignature.mockReturnValue({
        timestamp: '1710000000',
        signature: 'signature',
        api_key: 'api-key',
        cloud_name: 'sgt-cloud',
        folder: 'tutors/tutor-1',
        public_id: 'tutors/tutor-1/avatar',
      });

      const result = await service.getAvatarUploadSignature('tutor-1');

      expect(cloudinaryService.generateUploadSignature).toHaveBeenCalledWith(
        'tutors/tutor-1',
        'tutors/tutor-1/avatar',
      );
      expect(result).toEqual({
        timestamp: '1710000000',
        signature: 'signature',
        api_key: 'api-key',
        cloud_name: 'sgt-cloud',
        folder: 'tutors/tutor-1',
        public_id: 'tutors/tutor-1/avatar',
      });
    });

    it('should reject avatar signature when tutor does not exist', async () => {
      tutorRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAvatarUploadSignature('missing-tutor'),
      ).rejects.toMatchObject({
        response: {
          errorCode: 'RESOURCE_02',
          message: 'Tutor no encontrado',
        },
      });
    });

    it('should validate whether an avatar url belongs to the tutor', () => {
      expect(
        service.validateAvatarUrl(
          'https://res.cloudinary.com/sgt-cloud/image/upload/tutors/tutor-1/avatar.jpg',
          'tutor-1',
        ),
      ).toBe(true);
      expect(
        service.validateAvatarUrl(
          'https://res.cloudinary.com/sgt-cloud/image/upload/tutors/tutor-2/avatar.jpg',
          'tutor-1',
        ),
      ).toBe(false);
      expect(service.validateAvatarUrl('', 'tutor-1')).toBe(false);
    });

    it('should persist the secure url as tutor avatar', async () => {
      const tutorEntity = {
        idUser: 'tutor-2',
        urlImage: null,
      };

      tutorRepository.findOne.mockResolvedValue(tutorEntity);
      tutorRepository.save.mockResolvedValue({
        ...tutorEntity,
        urlImage:
          'https://res.cloudinary.com/sgt-cloud/image/upload/v1/tutors/tutor-2/avatar.jpg',
      });

      const result = await service.confirmAvatarUpload(
        'tutor-2',
        'https://res.cloudinary.com/sgt-cloud/image/upload/v1/tutors/tutor-2/avatar.jpg',
        'tutors/tutor-2/avatar',
      );

      expect(tutorRepository.findOne).toHaveBeenCalledWith({
        where: { idUser: 'tutor-2' },
      });
      expect(tutorRepository.save).toHaveBeenCalledWith({
        idUser: 'tutor-2',
        urlImage:
          'https://res.cloudinary.com/sgt-cloud/image/upload/v1/tutors/tutor-2/avatar.jpg',
      });
      expect(result).toEqual({
        message: 'Avatar actualizado correctamente',
      });
    });
  });
});
