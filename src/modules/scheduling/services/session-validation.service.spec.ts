import { BadRequestException, ConflictException } from '@nestjs/common';
import { SessionValidationService } from './session-validation.service';

describe('SessionValidationService', () => {
  let service: SessionValidationService;
  let sessionRepository: any;
  let availabilityService: any;
  let tutorService: any;

  const createQueryBuilderMock = () => {
    const qb: any = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getMany: jest.fn(),
    };
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    return qb;
  };

  beforeEach(() => {
    sessionRepository = {
      createQueryBuilder: jest.fn(),
    };
    availabilityService = {
      validateModalityForSlot: jest.fn(),
      getAvailabilityById: jest.fn(),
      isSlotAvailableForDateWithDuration: jest.fn(),
      isSlotAvailableForDate: jest.fn(),
    };
    tutorService = {
      getWeeklyHoursLimit: jest.fn(),
    };

    service = new SessionValidationService(
      sessionRepository,
      availabilityService,
      tutorService,
    );
  });

  // ─── validateStudentNotTutor ─────────────────────────────────────────────────

  describe('validateStudentNotTutor', () => {
    it('throws BadRequestException if student and tutor are the same user', () => {
      expect(() => service.validateStudentNotTutor('user-1', 'user-1')).toThrow(
        BadRequestException,
      );
    });

    it('does not throw when student and tutor are different users', () => {
      expect(() =>
        service.validateStudentNotTutor('student-1', 'tutor-1'),
      ).not.toThrow();
    });
  });

  // ─── calculateEndTime ────────────────────────────────────────────────────────

  describe('calculateEndTime', () => {
    it('calculates end time for a 2-hour session', () => {
      expect(service.calculateEndTime('09:00', 2)).toBe('11:00');
    });

    it('calculates end time for a 0.5-hour (30 min) session', () => {
      expect(service.calculateEndTime('08:30', 0.5)).toBe('09:00');
    });

    it('calculates end time crossing hour boundary with leading zeros', () => {
      expect(service.calculateEndTime('08:00', 1)).toBe('09:00');
    });

    it('handles 1.5-hour sessions correctly', () => {
      expect(service.calculateEndTime('10:30', 1.5)).toBe('12:00');
    });
  });

  // ─── validateScheduledDateMatchesSlotDay ─────────────────────────────────────

  describe('validateScheduledDateMatchesSlotDay', () => {
    it('resolves when scheduled date matches the slot day of week (Monday)', async () => {
      // 2025-04-07 is Monday; dayOfWeek=0 maps to UTC day 1 (Monday)
      availabilityService.getAvailabilityById.mockResolvedValue({
        dayOfWeek: 0,
      });

      await expect(
        service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when date does not match slot day', async () => {
      // 2025-04-07 is Monday but slot expects Tuesday (dayOfWeek=1)
      availabilityService.getAvailabilityById.mockResolvedValue({
        dayOfWeek: 1,
      });

      await expect(
        service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when slot dayOfWeek is out of valid range', async () => {
      availabilityService.getAvailabilityById.mockResolvedValue({
        dayOfWeek: 7,
      });

      await expect(
        service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── validateNoTimeConflict ───────────────────────────────────────────────────

  describe('validateNoTimeConflict', () => {
    it('resolves when no conflicting sessions exist', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateNoTimeConflict('tutor-1', '2025-04-07', '10:00', 1),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when new session overlaps an existing one', async () => {
      const qb = createQueryBuilderMock();
      // Existing: 10:00–11:00; Proposed: 10:30–11:30 → overlap
      qb.getMany.mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateNoTimeConflict('tutor-1', '2025-04-07', '10:30', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves when sessions are adjacent (no overlap)', async () => {
      const qb = createQueryBuilderMock();
      // Existing: 08:00–10:00; Proposed: 10:00–11:00 → adjacent, not overlapping
      qb.getMany.mockResolvedValue([{ startTime: '08:00', endTime: '10:00' }]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateNoTimeConflict('tutor-1', '2025-04-07', '10:00', 1),
      ).resolves.toBeUndefined();
    });

    it('applies exclude filter when excludeSessionId is provided', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await service.validateNoTimeConflict(
        'tutor-1',
        '2025-04-07',
        '10:00',
        1,
        'session-to-exclude',
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.idSession != :excludeSessionId',
        { excludeSessionId: 'session-to-exclude' },
      );
    });
  });

  // ─── validateWeeklyHoursLimit ─────────────────────────────────────────────────

  describe('validateWeeklyHoursLimit', () => {
    it('resolves when total hours remain below the weekly limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '11:00' }]); // 2h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

      await expect(
        service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 2), // 2+2=4 ≤ 10
      ).resolves.toBeUndefined();
    });

    it('resolves when total hours exactly equal the weekly limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]); // 8h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

      await expect(
        service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 2), // 8+2=10 = 10 (not > 10)
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when adding hours would exceed the weekly limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]); // 8h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

      await expect(
        service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 3), // 8+3=11 > 10
      ).rejects.toThrow(BadRequestException);
    });

    it('accumulates hours from multiple existing sessions correctly', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        { startTime: '09:00', endTime: '11:00' }, // 2h
        { startTime: '14:00', endTime: '17:00' }, // 3h — total 5h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);
      tutorService.getWeeklyHoursLimit.mockResolvedValue(6);

      await expect(
        service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 2), // 5+2=7 > 6
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── validateDailyHoursLimit ──────────────────────────────────────────────────

  describe('validateDailyHoursLimit', () => {
    it('resolves when total daily hours remain below the daily limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]); // 1h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2), // 1+2=3 ≤ 4
      ).resolves.toBeUndefined();
    });

    it('resolves when total daily hours exactly equal the daily limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '12:00' }]); // 3h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1), // 3+1=4 = 4 (not > 4)
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when adding hours would exceed the daily limit', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '12:00' }]); // 3h used
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1.5), // 3+1.5=4.5 > 4
      ).rejects.toThrow(BadRequestException);
    });

    it('accumulates hours from multiple existing sessions correctly', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        { startTime: '09:00', endTime: '10:00' }, // 1h
        { startTime: '14:00', endTime: '16:00' }, // 2h — total 3h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2), // 3+2=5 > 4
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves when there are no existing sessions on that date', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]); // No sessions
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.validateDailyHoursLimit('tutor-1', '2025-04-07', 3), // 0+3=3 ≤ 4
      ).resolves.toBeUndefined();
    });

    it('excludes specified session when checking for hours accumulation', async () => {
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        { startTime: '09:00', endTime: '12:00' }, // 3h (but will be excluded)
        { startTime: '14:00', endTime: '15:00' }, // 1h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      // When we exclude the 3h session, only 1h is counted, so 1+2=3 ≤ 4
      await expect(
        service.validateDailyHoursLimit(
          'tutor-1',
          '2025-04-07',
          2,
          'session-to-exclude',
        ),
      ).resolves.toBeUndefined();

      // Verify andWhere was called to exclude the session (should be called 4 times total)
      expect(qb.andWhere).toHaveBeenCalled();
      // Verify the specific exclude filter was applied
      const andWhereCalls = qb.andWhere.mock.calls;
      const excludeCall = andWhereCalls.find(
        (call: any[]) => call[0]?.includes('idSession !='),
      );
      expect(excludeCall).toBeDefined();
      expect(excludeCall?.[1]).toEqual({
        excludeSessionId: 'session-to-exclude',
      });
    });
  });

  // ─── validateCancellationTime ─────────────────────────────────────────────────

  describe('validateCancellationTime', () => {
    it('returns true when session is more than 24h in the future', () => {
      // Far future date — always more than 24h away
      expect(service.validateCancellationTime('2030-12-31', '12:00')).toBe(
        true,
      );
    });

    it('returns false when session is in the past', () => {
      // Past date — always less than 24h away
      expect(service.validateCancellationTime('2020-01-01', '12:00')).toBe(
        false,
      );
    });
  });
});
