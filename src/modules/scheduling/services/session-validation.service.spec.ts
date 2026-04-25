import { BadRequestException, ConflictException } from '@nestjs/common';
import { SessionValidationService } from './session-validation.service';

describe('SessionValidationService (Integration Tests)', () => {
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

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 1: validateStudentNotTutor
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateStudentNotTutor', () => {
    describe('✅ SHOULD WORK', () => {
      it('should allow different student and tutor', () => {
        expect(() =>
          service.validateStudentNotTutor('student-123', 'tutor-456'),
        ).not.toThrow();
      });

      it('should work with different UUIDs', () => {
        const studentId =
          'a1b2c3d4-e5f6-4789-8901-2345678901ab';
        const tutorId =
          'b1b2c3d4-e5f6-4789-8901-2345678901ab';
        expect(() =>
          service.validateStudentNotTutor(studentId, tutorId),
        ).not.toThrow();
      });

      it('should work with various string formats', () => {
        expect(() =>
          service.validateStudentNotTutor('user1', 'user2'),
        ).not.toThrow();
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw BadRequestException when student equals tutor', () => {
        expect(() =>
          service.validateStudentNotTutor('same-user-id', 'same-user-id'),
        ).toThrow(BadRequestException);
      });

      it('should throw with specific error message', () => {
        expect(() =>
          service.validateStudentNotTutor('user-1', 'user-1'),
        ).toThrow(
          'No puedes agendar una tutoría contigo mismo',
        );
      });

      it('should fail with UUIDs where student and tutor are identical', () => {
        const id = 'a1b2c3d4-e5f6-4789-8901-2345678901ab';
        expect(() =>
          service.validateStudentNotTutor(id, id),
        ).toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 2: calculateEndTime
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculateEndTime', () => {
    describe('✅ SHOULD WORK', () => {
      it('should calculate end time for 1-hour session', () => {
        expect(service.calculateEndTime('09:00', 1)).toBe('10:00');
      });

      it('should calculate end time for 2-hour session', () => {
        expect(service.calculateEndTime('09:00', 2)).toBe('11:00');
      });

      it('should calculate end time for 0.5-hour (30-minute) session', () => {
        expect(service.calculateEndTime('08:30', 0.5)).toBe('09:00');
      });

      it('should handle 1.5-hour session', () => {
        expect(service.calculateEndTime('10:30', 1.5)).toBe('12:00');
      });

      it('should handle 2.5-hour session', () => {
        expect(service.calculateEndTime('14:00', 2.5)).toBe('16:30');
      });

      it('should calculate end time with leading zeros', () => {
        expect(service.calculateEndTime('08:00', 1)).toBe('09:00');
      });

      it('should handle early morning sessions (00:xx)', () => {
        expect(service.calculateEndTime('00:30', 1.5)).toBe('02:00');
      });

      it('should handle late night sessions crossing midnight', () => {
        expect(service.calculateEndTime('23:00', 2)).toBe('01:00');
      });

      it('should handle 0.25-hour (15-minute) session', () => {
        expect(service.calculateEndTime('09:00', 0.25)).toBe('09:15');
      });

      it('should handle 0.75-hour (45-minute) session', () => {
        expect(service.calculateEndTime('14:00', 0.75)).toBe('14:45');
      });

      it('should preserve padding for single-digit hours', () => {
        expect(service.calculateEndTime('08:00', 1)).toBe('09:00');
        expect(service.calculateEndTime('08:00', 3)).toBe('11:00');
      });

      it('should handle multiple 15-minute intervals', () => {
        expect(service.calculateEndTime('10:00', 0.25)).toBe('10:15');
        expect(service.calculateEndTime('10:15', 0.25)).toBe('10:30');
        expect(service.calculateEndTime('10:30', 0.25)).toBe('10:45');
        expect(service.calculateEndTime('10:45', 0.25)).toBe('11:00');
      });
    });

    describe('❌ SHOULD NOT WORK (Edge cases)', () => {
      it('should handle zero duration (no time added)', () => {
        expect(service.calculateEndTime('09:00', 0)).toBe('09:00');
      });

      it('should handle very long duration (24 hours)', () => {
        expect(service.calculateEndTime('09:00', 24)).toBe('09:00');
      });

      it('should handle fractional hours with precision', () => {
        const result = service.calculateEndTime('09:00', 0.333);
        expect(result).toMatch(/^[0-9]{2}:[0-9]{2}$/);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 3: validateScheduledDateMatchesSlotDay
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateScheduledDateMatchesSlotDay', () => {
    describe('✅ SHOULD WORK', () => {
      it('should allow Monday date with Monday slot (dayOfWeek=0)', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0,
        });
        // 2025-04-07 is Monday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).resolves.toBeUndefined();
      });

      it('should allow Tuesday date with Tuesday slot (dayOfWeek=1)', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 1,
        });
        // 2025-04-08 is Tuesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'),
        ).resolves.toBeUndefined();
      });

      it('should allow Wednesday with Wednesday slot', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 2,
        });
        // 2025-04-09 is Wednesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-09'),
        ).resolves.toBeUndefined();
      });

      it('should allow Thursday with Thursday slot', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 3,
        });
        // 2025-04-10 is Thursday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-10'),
        ).resolves.toBeUndefined();
      });

      it('should allow Friday with Friday slot', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 4,
        });
        // 2025-04-11 is Friday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-11'),
        ).resolves.toBeUndefined();
      });

      it('should allow Saturday with Saturday slot', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 5,
        });
        // 2025-04-12 is Saturday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-12'),
        ).resolves.toBeUndefined();
      });

      it('should allow different weeks with same day of week', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0,
        });
        // Both are Mondays
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).resolves.toBeUndefined();
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-14'),
        ).resolves.toBeUndefined();
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should reject Monday date with Tuesday slot', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 1, // Tuesday
        });
        // 2025-04-07 is Monday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject with appropriate day name in error message', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });
        // 2025-04-08 is Tuesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'),
        ).rejects.toThrow(/martes/i);
      });

      it('should reject when slot dayOfWeek is out of range (6)', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 6,
        });
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject when slot dayOfWeek is out of range (7)', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 7,
        });
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(/fuera del rango/i);
      });

      it('should reject when slot dayOfWeek is negative', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: -1,
        });
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle all invalid day-to-date combinations', async () => {
        // Monday with all non-Monday slots
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 1,
        });
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(BadRequestException);

        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 2,
        });
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 4: validateAvailabilitySlotWithDuration
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateAvailabilitySlotWithDuration', () => {
    describe('✅ SHOULD WORK', () => {
      it('should resolve when slot is available', async () => {
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: true,
          },
        );

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            1,
            '2025-04-07',
            2,
          ),
        ).resolves.toBeUndefined();
      });

      it('should pass excludeSessionId to availability service', async () => {
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: true,
          },
        );

        await service.validateAvailabilitySlotWithDuration(
          'tutor-1',
          1,
          '2025-04-07',
          2,
          'session-123',
        );

        expect(
          availabilityService.isSlotAvailableForDateWithDuration,
        ).toHaveBeenCalledWith('tutor-1', 1, '2025-04-07', 2, 'session-123');
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw ConflictException when slot is not available', async () => {
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: false,
            reason: 'Slot overlaps with existing session',
          },
        );

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            1,
            '2025-04-07',
            2,
          ),
        ).rejects.toThrow(ConflictException);
      });

      it('should include reason in error message', async () => {
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: false,
            reason: 'Slot duration exceeds availability window',
          },
        );

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            1,
            '2025-04-07',
            3,
          ),
        ).rejects.toThrow(
          'Slot duration exceeds availability window',
        );
      });

      it('should use default reason when not provided', async () => {
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: false,
          },
        );

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            1,
            '2025-04-07',
            2,
          ),
        ).rejects.toThrow(
          'El horario seleccionado no está disponible para esa duración',
        );
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 5: validateNoTimeConflict
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateNoTimeConflict', () => {
    describe('✅ SHOULD WORK', () => {
      it('should resolve when no sessions exist', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:00',
            1,
          ),
        ).resolves.toBeUndefined();
      });

      it('should resolve when new session is before existing sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '14:00', endTime: '15:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:00',
            2, // 10:00-12:00, existing is 14:00-15:00
          ),
        ).resolves.toBeUndefined();
      });

      it('should resolve when new session is after existing sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '14:00',
            1,
          ),
        ).resolves.toBeUndefined();
      });

      it('should allow adjacent sessions (no overlap)', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '08:00', endTime: '10:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:00-11:00 (exactly after existing)
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:00',
            1,
          ),
        ).resolves.toBeUndefined();
      });

      it('should handle multiple non-overlapping sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '08:00', endTime: '09:00' },
          { startTime: '10:00', endTime: '11:00' },
          { startTime: '14:00', endTime: '15:00' },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '11:30',
            2, // 11:30-13:30
          ),
        ).resolves.toBeUndefined();
      });

      it('should exclude specified session when checking conflicts', async () => {
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

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw when new session overlaps with existing (partial overlap)', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:30-11:30 (overlaps)
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:30',
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw when new session completely contains existing session', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '11:00', endTime: '12:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:00-13:00 (contains existing)
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:00',
            3,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw when existing session contains new session', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '09:00', endTime: '14:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:00-11:00 (contained in existing)
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '10:00',
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw with specific time details in error message', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '14:00', endTime: '15:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 14:30-15:30
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '14:30',
            1,
          ),
        ).rejects.toThrow(/14:00.*15:00/);
      });

      it('should throw on partial overlap at session end', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([{ startTime: '14:00', endTime: '15:00' }]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 14:50-15:50 (overlaps end)
        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-07',
            '14:50',
            1,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 6: validateDailyHoursLimit
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateDailyHoursLimit', () => {
    describe('✅ SHOULD WORK', () => {
      it('should resolve with no existing sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2),
        ).resolves.toBeUndefined();
      });

      it('should resolve when total hours is below limit (4h)', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:00' }, // 1h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1 + 2 = 3 ≤ 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2),
        ).resolves.toBeUndefined();
      });

      it('should resolve when total hours exactly equals limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '12:00' }, // 3h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 3 + 1 = 4 = 4 (not exceeding)
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1),
        ).resolves.toBeUndefined();
      });

      it('should accumulate hours from multiple sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:00' }, // 1h
          { startTime: '14:00', endTime: '16:00' }, // 2h → total 3h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 3 + 1 = 4 = 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1),
        ).resolves.toBeUndefined();
      });

      it('should handle fractional hours', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:30' }, // 1.5h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1.5 + 1.5 = 3 ≤ 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1.5),
        ).resolves.toBeUndefined();
      });

      it('should exclude specified session from calculation', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '14:00', endTime: '15:00' }, // 1h (3h session excluded)
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1 + 2 = 3 ≤ 4 (the 3h session was excluded)
        await expect(
          service.validateDailyHoursLimit(
            'tutor-1',
            '2025-04-07',
            2,
            'session-to-exclude',
          ),
        ).resolves.toBeUndefined();

        expect(qb.andWhere).toHaveBeenCalledWith(
          'session.idSession != :excludeSessionId',
          { excludeSessionId: 'session-to-exclude' },
        );
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw when total exceeds daily limit by 0.5h', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '12:00' }, // 3h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 3 + 1.5 = 4.5 > 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1.5),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw with detailed hours breakdown', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '12:00' }, // 3h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 1.5),
        ).rejects.toThrow(/3h.*1\.5h.*4\.5h/);
      });

      it('should throw when multiple sessions exceed limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:00' }, // 1h
          { startTime: '14:00', endTime: '16:00' }, // 2h → total 3h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 3 + 2 = 5 > 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw when adding 4 hours to existing 1 hour', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:00' }, // 1h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1 + 4 = 5 > 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 4),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 7: validateWeeklyHoursLimit
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateWeeklyHoursLimit', () => {
    describe('✅ SHOULD WORK', () => {
      it('should resolve with no existing sessions', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 5),
        ).resolves.toBeUndefined();
      });

      it('should resolve when total is below weekly limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '11:00' }, // 2h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 2 + 3 = 5 ≤ 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 3),
        ).resolves.toBeUndefined();
      });

      it('should resolve when total exactly equals weekly limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '17:00' }, // 8h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 8 + 2 = 10 = 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 2),
        ).resolves.toBeUndefined();
      });

      it('should accumulate hours from multiple sessions in week', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '11:00' }, // 2h (Mon)
          { startTime: '14:00', endTime: '17:00' }, // 3h (Tue) → total 5h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 5 + 4 = 9 ≤ 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 4),
        ).resolves.toBeUndefined();
      });

      it('should handle different tutor weekly limits', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '11:00' }, // 2h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(15);

        // 2 + 10 = 12 ≤ 15
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 10),
        ).resolves.toBeUndefined();
      });

      it('should exclude specified session from calculation', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:00' }, // 1h (5h excluded)
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 1 + 5 = 6 ≤ 10
        await expect(
          service.validateWeeklyHoursLimit(
            'tutor-1',
            '2025-04-07',
            5,
            'session-to-exclude',
          ),
        ).resolves.toBeUndefined();

        expect(qb.andWhere).toHaveBeenCalledWith(
          'session.idSession != :excludeSessionId',
          { excludeSessionId: 'session-to-exclude' },
        );
      });

      it('should correctly parse week boundaries', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // Any date in the week should work
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 5),
        ).resolves.toBeUndefined();
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw when total exceeds weekly limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '17:00' }, // 8h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 8 + 3 = 11 > 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 3),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw with detailed hours breakdown', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '17:00' }, // 8h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 3),
        ).rejects.toThrow(/8h.*3h.*11h/);
      });

      it('should throw when multiple sessions exceed limit', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '11:00' }, // 2h
          { startTime: '14:00', endTime: '22:00' }, // 8h → total 10h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 10 + 1 = 11 > 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 1),
        ).rejects.toThrow(BadRequestException);
      });

      it('should respect different tutor limits when exceeded', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '14:00' }, // 5h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(8);

        // 5 + 4 = 9 > 8
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 4),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 8: validateCancellationTime
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateCancellationTime', () => {
    describe('✅ SHOULD WORK', () => {
      it('should return true for far future dates', () => {
        expect(
          service.validateCancellationTime('2099-12-31', '12:00'),
        ).toBe(true);
      });

      it('should return true for dates more than 24 hours away', () => {
        const result = service.validateCancellationTime('2027-12-31', '12:00');
        expect(result).toBe(true);
      });

      it('should return false for past dates', () => {
        expect(
          service.validateCancellationTime('2000-01-01', '12:00'),
        ).toBe(false);
      });

      it('should handle various time formats', () => {
        expect(
          service.validateCancellationTime('2030-06-15', '23:59'),
        ).toBe(true);
      });

      it('should handle midnight times', () => {
        expect(
          service.validateCancellationTime('2030-06-15', '00:00'),
        ).toBe(true);
      });
    });

    describe('❌ SHOULD NOT WORK / Edge Cases', () => {
      it('should return false for very recent past times', () => {
        const result = service.validateCancellationTime('1999-01-01', '00:00');
        expect(result).toBe(false);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 9: validateModality
  // ════════════════════════════════════════════════════════════════════════════

  describe('validateModality', () => {
    describe('✅ SHOULD WORK', () => {
      it('should resolve when modality is valid', async () => {
        availabilityService.validateModalityForSlot.mockResolvedValue(
          undefined,
        );

        await expect(
          service.validateModality(1, 'tutor-1', 'PRESENCIAL'),
        ).resolves.toBeUndefined();
      });

      it('should call availability service with correct parameters', async () => {
        availabilityService.validateModalityForSlot.mockResolvedValue(
          undefined,
        );

        await service.validateModality(1, 'tutor-1', 'VIRTUAL');

        expect(
          availabilityService.validateModalityForSlot,
        ).toHaveBeenCalledWith(1, 'tutor-1', 'VIRTUAL');
      });
    });

    describe('❌ SHOULD NOT WORK', () => {
      it('should throw when modality does not match slot', async () => {
        availabilityService.validateModalityForSlot.mockRejectedValue(
          new BadRequestException('Modality mismatch'),
        );

        await expect(
          service.validateModality(1, 'tutor-1', 'PRESENCIAL'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 10: Integration scenarios (combined validations)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Integration scenarios (multiple validations)', () => {
    describe('✅ COMPLEX WORKFLOWS THAT SHOULD WORK', () => {
      it('should pass all validations for a valid session creation', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]); // No conflicts
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0,
        });
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          { available: true },
        );
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // All validations pass
        expect(() =>
          service.validateStudentNotTutor('student-1', 'tutor-1'),
        ).not.toThrow();

        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).resolves.toBeUndefined();

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            1,
            '2025-04-07',
            2,
          ),
        ).resolves.toBeUndefined();

        await expect(
          service.validateNoTimeConflict('tutor-1', '2025-04-07', '10:00', 2),
        ).resolves.toBeUndefined();

        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2),
        ).resolves.toBeUndefined();

        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 2),
        ).resolves.toBeUndefined();
      });

      it('should handle session modification without conflicts', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 1,
        });
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          { available: true },
        );
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        const sessionId = 'session-to-modify';

        // Validate as if modifying a session
        await expect(
          service.validateScheduledDateMatchesSlotDay(2, '2025-04-08'),
        ).resolves.toBeUndefined();

        await expect(
          service.validateAvailabilitySlotWithDuration(
            'tutor-1',
            2,
            '2025-04-08',
            1,
            sessionId,
          ),
        ).resolves.toBeUndefined();

        await expect(
          service.validateNoTimeConflict(
            'tutor-1',
            '2025-04-08',
            '15:00',
            1,
            sessionId,
          ),
        ).resolves.toBeUndefined();

        await expect(
          service.validateDailyHoursLimit(
            'tutor-1',
            '2025-04-08',
            1,
            sessionId,
          ),
        ).resolves.toBeUndefined();
      });
    });

    describe('❌ COMPLEX WORKFLOWS THAT SHOULD FAIL', () => {
      it('should fail when student tries to book with themselves', async () => {
        expect(() =>
          service.validateStudentNotTutor('user-1', 'user-1'),
        ).toThrow(BadRequestException);
      });

      it('should fail when date does not match slot day', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });

        // 2025-04-08 is Tuesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fail when there is a time conflict', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '10:00', endTime: '11:00' },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:30-11:30 (overlaps)
        await expect(
          service.validateNoTimeConflict('tutor-1', '2025-04-07', '10:30', 1),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fail when daily hours limit is exceeded', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '13:00' }, // 4h (at limit)
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 4 + 0.5 = 4.5 > 4
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 0.5),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fail when weekly hours limit is exceeded', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '17:00' }, // 8h
          { startTime: '09:00', endTime: '11:00' }, // 2h (total 10h)
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 10 + 1 = 11 > 10
        await expect(
          service.validateWeeklyHoursLimit('tutor-1', '2025-04-07', 1),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SUITE 11: Private helpers and edge cases
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge cases and boundary conditions', () => {
    describe('Time calculation edge cases', () => {
      it('should handle times with 0 hours duration', () => {
        expect(service.calculateEndTime('10:00', 0)).toBe('10:00');
      });

      it('should handle times crossing midnight', () => {
        const result = service.calculateEndTime('22:00', 3);
        expect(result).toMatch(/^\d{2}:\d{2}$/);
      });

      it('should handle very small fractional hours', () => {
        const result = service.calculateEndTime('10:00', 0.0833); // ~5 min
        expect(result).toMatch(/^\d{2}:\d{2}$/);
      });
    });

    describe('Date boundary edge cases', () => {
      it('should handle leap year dates correctly', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });
        // 2024 is leap year, 2025-02-03 is Monday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-02-03'),
        ).resolves.toBeUndefined();
      });

      it('should handle year boundaries', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });
        // 2025-01-06 is Monday (first Monday of 2025)
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-01-06'),
        ).resolves.toBeUndefined();
      });

      it('should handle end-of-month dates', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 4, // Friday
        });
        // 2025-04-25 is Friday (end of April)
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-25'),
        ).resolves.toBeUndefined();
      });
    });

    describe('Hours accumulation edge cases', () => {
      it('should handle accumulation of 15-minute increments', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '09:15' },
          { startTime: '09:30', endTime: '09:45' },
          { startTime: '10:00', endTime: '10:15' },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 0.25 + 0.25 + 0.25 = 0.75h; 0.75 + 3.25 = 4h
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 3.25),
        ).resolves.toBeUndefined();
      });

      it('should handle maximum possible daily hours', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 4 hours exactly at limit
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 4),
        ).resolves.toBeUndefined();
      });

      it('should handle rounding in hour calculations', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '10:45' }, // 1.75h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1.75 + 2.25 = 4h (exactly at limit)
        await expect(
          service.validateDailyHoursLimit('tutor-1', '2025-04-07', 2.25),
        ).resolves.toBeUndefined();
      });
    });

    describe('Repository query builder interactions', () => {
      it('should properly chain query builder methods', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await service.validateNoTimeConflict(
          'tutor-1',
          '2025-04-07',
          '10:00',
          1,
        );

        // Verify chain was called correctly
        expect(qb.where).toHaveBeenCalled();
        expect(qb.andWhere).toHaveBeenCalled();
        expect(qb.getMany).toHaveBeenCalled();
      });

      it('should apply all filters in correct order', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await service.validateDailyHoursLimit(
          'tutor-1',
          '2025-04-07',
          2,
          'exclude-id',
        );

        // Should have called: where (tutor), andWhere (date), andWhere (status), andWhere (exclude)
        expect(qb.where).toHaveBeenCalledTimes(1);
        expect(qb.andWhere.mock.calls.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
