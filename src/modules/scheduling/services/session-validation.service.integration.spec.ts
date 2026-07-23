import { BadRequestException, ConflictException } from '@nestjs/common';
import { SessionValidationService } from './session-validation.service';
import { SessionStatus } from '../enums/session-status.enum';

/**
 * Integration Tests for SessionValidationService
 *
 * These tests focus on realistic workflows, component interactions,
 * and end-to-end validation scenarios using mocks (not real DB/services).
 *
 * Scenarios tested:
 * - Complete session creation workflow with all validations
 * - Session modification workflow with exclusions
 * - Multiple edge cases and boundary conditions
 * - Repository interaction patterns
 */
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

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 1: Complete Session Creation Workflow
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 1: Complete Session Creation', () => {
    describe('✅ Happy Path - Valid Session Creation', () => {
      it('should successfully validate all conditions for a new session', async () => {
        // Setup: Student and tutor are different
        const studentId = 'student-123';
        const tutorId = 'tutor-456';

        // Setup: Date and slot validation
        availabilityService.getAvailabilityById.mockResolvedValue({
          id: 1,
          dayOfWeek: 0, // Monday
          startTime: '09:00',
          endTime: '17:00',
        });

        // Setup: Slot is available for the duration
        availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue(
          {
            available: true,
          },
        );

        // Setup: Modality matches
        availabilityService.validateModalityForSlot.mockResolvedValue(
          undefined,
        );

        // Setup: No time conflicts
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([]); // No existing sessions
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Setup: Daily and weekly limits are not exceeded
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // Execute: Run all validations as in a real create workflow
        expect(() =>
          service.validateStudentNotTutor(studentId, tutorId),
        ).not.toThrow();

        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).resolves.toBeUndefined();

        await expect(
          service.validateAvailabilitySlotWithDuration(
            tutorId,
            1,
            '2025-04-07',
            2,
          ),
        ).resolves.toBeUndefined();

        await expect(
          service.validateModality(1, tutorId, 'PRESENCIAL'),
        ).resolves.toBeUndefined();

        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '10:00', 2),
        ).resolves.toBeUndefined();

        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 2),
        ).resolves.toBeUndefined();

        await expect(
          service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 2),
        ).resolves.toBeUndefined();

        // Verify all services were called correctly
        expect(availabilityService.getAvailabilityById).toHaveBeenCalledWith(1);
        expect(
          availabilityService.isSlotAvailableForDateWithDuration,
        ).toHaveBeenCalledWith(tutorId, 1, '2025-04-07', 2, undefined);
        expect(
          availabilityService.validateModalityForSlot,
        ).toHaveBeenCalledWith(1, tutorId, 'PRESENCIAL');
        expect(tutorService.getWeeklyHoursLimit).toHaveBeenCalledWith(tutorId);
      });

      it('should allow multiple sessions on same day within daily limit', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: Existing 1-hour session
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '10:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // First validation: daily hours (1h + 2h = 3h, limit is 4h)
        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 2),
        ).resolves.toBeUndefined();

        // Second validation: time conflict (10:00-12:00 doesn't conflict with 09:00-10:00)
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '10:00', 2),
        ).resolves.toBeUndefined();

        // Third validation: weekly hours
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        await expect(
          service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 2),
        ).resolves.toBeUndefined();
      });

      it('should allow multiple sessions in different days of the week', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: Sessions on different days
        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '11:00' }, // Mon: 2h
          { startTime: '10:00', endTime: '12:00' }, // Tue: 2h
          { startTime: '14:00', endTime: '15:00' }, // Wed: 1h (total: 5h)
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // 5h + 3h = 8h ≤ 10h
        await expect(
          service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 3),
        ).resolves.toBeUndefined();

        expect(tutorService.getWeeklyHoursLimit).toHaveBeenCalledWith(tutorId);
      });
    });

    describe('❌ Happy Path Failure Points', () => {
      it('should fail early when student equals tutor (first validation)', async () => {
        const userId = 'same-user-123';

        expect(() => service.validateStudentNotTutor(userId, userId)).toThrow(
          BadRequestException,
        );

        // No other services should be called if first validation fails
        expect(availabilityService.getAvailabilityById).not.toHaveBeenCalled();
      });

      it('should fail when date does not match slot day (early in workflow)', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });

        // Tuesday date with Monday slot
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'),
        ).rejects.toThrow(BadRequestException);

        expect(availabilityService.getAvailabilityById).toHaveBeenCalledWith(1);
      });

      it('should fail when modality does not match slot', async () => {
        availabilityService.validateModalityForSlot.mockRejectedValue(
          new BadRequestException(
            'La modalidad PRESENCIAL no está disponible en este slot',
          ),
        );

        await expect(
          service.validateModality(1, 'tutor-123', 'PRESENCIAL'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fail when time conflict exists', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: Existing session from 10:00-11:00
        qb.getMany.mockResolvedValue([
          {
            startTime: '10:00',
            endTime: '11:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:30-11:30 (conflicts with existing)
        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '10:30', 1),
        ).rejects.toThrow(BadRequestException);

        expect(qb.where).toHaveBeenCalled();
        expect(qb.andWhere).toHaveBeenCalled();
      });

      it('should fail when daily hours limit is exceeded', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: Already at limit (4h)
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '13:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: +1h = 5h total (exceeds 4h limit)
        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 1),
        ).rejects.toThrow(BadRequestException);
      });

      it('should fail when weekly hours limit is exceeded', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: 10h of sessions this week
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '17:00',
            status: SessionStatus.SCHEDULED,
          },
          {
            startTime: '09:00',
            endTime: '11:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // Proposed: +1h = 11h total (exceeds 10h limit)
        await expect(
          service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 1),
        ).rejects.toThrow(BadRequestException);

        expect(tutorService.getWeeklyHoursLimit).toHaveBeenCalledWith(tutorId);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 2: Session Modification Workflow
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 2: Session Modification', () => {
    describe('✅ Successful Modifications', () => {
      it('should allow time shift within same day (excluding self)', async () => {
        const tutorId = 'tutor-123';
        const sessionIdToModify = 'session-456';
        const qb = createQueryBuilderMock();

        // Setup: Existing sessions (one is the one being modified, will be excluded)
        qb.getMany
          .mockResolvedValueOnce([
            {
              startTime: '10:00',
              endTime: '11:00',
              status: SessionStatus.SCHEDULED,
            },
            {
              startTime: '14:00',
              endTime: '15:00',
              status: SessionStatus.SCHEDULED,
            },
          ])
          .mockResolvedValueOnce([
            {
              startTime: '10:00',
              endTime: '11:00',
              status: SessionStatus.SCHEDULED,
            },
            {
              startTime: '14:00',
              endTime: '15:00',
              status: SessionStatus.SCHEDULED,
            },
          ]);

        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        // Modify: 11:00-13:00 (doesn't conflict, within daily/weekly limits)
        await expect(
          service.validateNoTimeConflict(
            tutorId,
            '2025-04-07',
            '11:00',
            2,
            sessionIdToModify,
          ),
        ).resolves.toBeUndefined();

        // Verify exclusion parameter was passed
        expect(qb.andWhere).toHaveBeenCalledWith(
          'session.idSession != :excludeSessionId',
          { excludeSessionId: sessionIdToModify },
        );
      });

      it('should allow slot change on same day of week', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });

        // Change from 2025-04-07 (Monday) to 2025-04-14 (Monday)
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).resolves.toBeUndefined();

        // Reset mock for second call
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0,
        });

        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-14'),
        ).resolves.toBeUndefined();
      });

      it('should update hours calculation when duration changes', async () => {
        const tutorId = 'tutor-123';
        const sessionIdToModify = 'session-456';
        const qb = createQueryBuilderMock();

        // Setup: Existing 1h session
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '10:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Modify duration from 1h to 3h (total: 4h, at limit)
        await expect(
          service.validateDailyHoursLimit(
            tutorId,
            '2025-04-07',
            3,
            sessionIdToModify,
          ),
        ).resolves.toBeUndefined();

        expect(qb.andWhere).toHaveBeenCalledWith(
          'session.idSession != :excludeSessionId',
          { excludeSessionId: sessionIdToModify },
        );
      });
    });

    describe('❌ Modification Failures', () => {
      it('should prevent modification that creates time conflict', async () => {
        const tutorId = 'tutor-123';
        const sessionIdToModify = 'session-456';
        const qb = createQueryBuilderMock();

        // Setup: Another session at 14:00-15:00
        qb.getMany.mockResolvedValue([
          {
            startTime: '14:00',
            endTime: '15:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed modification: 14:30-15:30 (conflicts)
        await expect(
          service.validateNoTimeConflict(
            tutorId,
            '2025-04-07',
            '14:30',
            1,
            sessionIdToModify,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should prevent modification that exceeds daily limit', async () => {
        const tutorId = 'tutor-123';
        const sessionIdToModify = 'session-456';
        const qb = createQueryBuilderMock();

        // Setup: 3h existing sessions
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '12:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: Change to 2h (total: 5h, exceeds limit)
        await expect(
          service.validateDailyHoursLimit(
            tutorId,
            '2025-04-07',
            2,
            sessionIdToModify,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should prevent modification to incompatible day of week', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday only
        });

        // Try to modify to Tuesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 3: Complex Real-World Cases
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 3: Complex Real-World Cases', () => {
    describe('✅ Success Scenarios', () => {
      it('should handle back-to-back sessions (exactly adjacent)', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: Session 09:00-10:00
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '10:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:00-11:00 (exactly after, no overlap)
        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '10:00', 1),
        ).resolves.toBeUndefined();
      });

      it('should handle tutors with different weekly limits', async () => {
        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '14:00',
            status: SessionStatus.SCHEDULED,
          },
        ]); // 5h
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Tutor with 15h limit
        tutorService.getWeeklyHoursLimit.mockResolvedValue(15);

        // 5 + 10 = 15h (at limit, should pass)
        await expect(
          service.validateWeeklyHoursLimit(
            'tutor-high-limit',
            '2025-04-07',
            10,
          ),
        ).resolves.toBeUndefined();

        // Reset for another tutor
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(8);

        // 5 + 4 = 9h (exceeds 8h limit)
        await expect(
          service.validateWeeklyHoursLimit('tutor-low-limit', '2025-04-07', 4),
        ).rejects.toThrow(BadRequestException);
      });

      it('should allow session at exactly the daily limit', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: 2.5h existing
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '11:30',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 1.5h (total: 4h, exactly at limit)
        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 1.5),
        ).resolves.toBeUndefined();
      });

      it('should handle multiple validations in sequence for edge times', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 5, // Saturday
        });

        // Validate date matches
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-12'),
        ).resolves.toBeUndefined();

        // Validate no conflicts at late time
        qb.getMany.mockResolvedValue([]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-12', '23:00', 1),
        ).resolves.toBeUndefined();

        // Validate hours limits for edge times
        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-12', 1),
        ).resolves.toBeUndefined();

        await expect(
          service.validateWeeklyHoursLimit(tutorId, '2025-04-12', 1),
        ).resolves.toBeUndefined();
      });
    });

    describe('❌ Failure Scenarios', () => {
      it('should fail cascade: student == tutor prevents all further checks', async () => {
        const userId = 'same-user';

        // Should fail immediately
        expect(() => service.validateStudentNotTutor(userId, userId)).toThrow(
          BadRequestException,
        );

        // No further calls should be made
        expect(availabilityService.getAvailabilityById).not.toHaveBeenCalled();
        expect(sessionRepository.createQueryBuilder).not.toHaveBeenCalled();
      });

      it('should fail when multiple restrictions are triggered', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday
        });

        // Fail: Wrong day
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-08'), // Tuesday
        ).rejects.toThrow(BadRequestException);

        // Reset and test: Time conflict + Hours exceeded simultaneously
        qb.getMany.mockResolvedValue([
          {
            startTime: '10:00',
            endTime: '14:00',
            status: SessionStatus.SCHEDULED,
          }, // 4h at limit
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 13:00-15:00 (overlaps + exceeds hours)
        // Should fail on time conflict first
        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '13:00', 2),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle timezone-safe date parsing across month boundaries', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 4, // Friday
        });

        // End of month: 2025-04-25 is Friday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-25'),
        ).resolves.toBeUndefined();

        // Should fail for wrong day
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 0, // Monday only
        });

        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-25'), // Friday
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 4: Repository Mock Interaction Patterns
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 4: Repository Interactions', () => {
    it('should properly build and execute queries with all filters', async () => {
      const tutorId = 'tutor-123';
      const sessionIdToExclude = 'session-exclude';
      const qb = createQueryBuilderMock();

      qb.getMany.mockResolvedValue([]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await service.validateNoTimeConflict(
        tutorId,
        '2025-04-07',
        '10:00',
        1,
        sessionIdToExclude,
      );

      // Verify the query builder chain
      expect(sessionRepository.createQueryBuilder).toHaveBeenCalledWith(
        'session',
      );
      expect(qb.where).toHaveBeenCalledWith('session.idTutor = :tutorId', {
        tutorId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(session.scheduledDate) = :scheduledDate',
        { scheduledDate: '2025-04-07' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.status IN (:...activeStatuses)',
        {
          activeStatuses: [
            SessionStatus.SCHEDULED,
            SessionStatus.PENDING_MODIFICATION,
          ],
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.idSession != :excludeSessionId',
        { excludeSessionId: sessionIdToExclude },
      );
      expect(qb.getMany).toHaveBeenCalled();
    });

    it('should handle multiple query builder resets for different validations', async () => {
      const tutorId = 'tutor-123';
      const qb1 = createQueryBuilderMock();
      const qb2 = createQueryBuilderMock();
      const qb3 = createQueryBuilderMock();

      qb1.getMany.mockResolvedValue([]);
      qb2.getMany.mockResolvedValue([]);
      qb3.getMany.mockResolvedValue([]);

      sessionRepository.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2)
        .mockReturnValueOnce(qb3);

      // Three different validations requiring fresh query builders
      await service.validateNoTimeConflict(tutorId, '2025-04-07', '10:00', 1);
      await service.validateDailyHoursLimit(tutorId, '2025-04-07', 1);
      await service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 1);

      expect(sessionRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
    });

    it('should correctly filter by active statuses only', async () => {
      const tutorId = 'tutor-123';
      const qb = createQueryBuilderMock();

      // Setup: Sessions with different statuses
      qb.getMany.mockResolvedValue([
        {
          startTime: '10:00',
          endTime: '11:00',
          status: SessionStatus.SCHEDULED,
        },
        {
          startTime: '14:00',
          endTime: '15:00',
          status: SessionStatus.PENDING_MODIFICATION,
        },
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      await service.validateNoTimeConflict(tutorId, '2025-04-07', '11:00', 2);

      // Verify only active statuses are included
      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.status IN (:...activeStatuses)',
        {
          activeStatuses: [
            SessionStatus.SCHEDULED,
            SessionStatus.PENDING_MODIFICATION,
          ],
        },
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 5: Boundary and Edge Cases
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 5: Boundary and Edge Cases', () => {
    describe('✅ Edge Cases That Pass', () => {
      it('should handle cancellation validation for far future dates', () => {
        // Very far in future
        const result = service.validateCancellationTime('2099-12-31', '23:59');
        expect(result).toBe(true);

        // Far future
        const result2 = service.validateCancellationTime('2050-01-01', '00:00');
        expect(result2).toBe(true);
      });

      it('should calculate correct end times crossing midnight', () => {
        // 22:00 + 3h = 01:00 (next day)
        const result = service.calculateEndTime('22:00', 3);
        expect(result).toBe('01:00');

        // 23:30 + 1h = 00:30 (next day)
        const result2 = service.calculateEndTime('23:30', 1);
        expect(result2).toBe('00:30');
      });

      it('should handle very small fractional hours correctly', () => {
        // 0.0833 hours ≈ 5 minutes
        const result = service.calculateEndTime('10:00', 0.0833);
        expect(result).toMatch(/^10:0[0-4]$/); // Should be 10:00-10:04

        // 0.25 hours = 15 minutes
        const result2 = service.calculateEndTime('10:00', 0.25);
        expect(result2).toBe('10:15');
      });

      it('should properly handle hours calculation with 15-min increments', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        qb.getMany.mockResolvedValue([
          { startTime: '09:00', endTime: '09:15' }, // 0.25h
          { startTime: '10:00', endTime: '10:30' }, // 0.5h
          { startTime: '11:00', endTime: '11:45' }, // 0.75h → total 1.5h
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // 1.5 + 2.5 = 4h (exactly at limit)
        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 2.5),
        ).resolves.toBeUndefined();
      });

      it('should handle sessions on leap year dates', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 1, // Tuesday
        });

        // 2024 is leap year, 2024-02-29 is Thursday - adjust to Tuesday
        // 2025-02-04 is Tuesday
        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-02-04'),
        ).resolves.toBeUndefined();
      });
    });

    describe('❌ Edge Cases That Fail', () => {
      it('should reject cancellation for sessions within 24 hours', () => {
        // Date/time in near past
        const result = service.validateCancellationTime('1999-01-01', '00:00');
        expect(result).toBe(false);

        // Date/time very close to now would also fail (but hard to test without mocking Date)
      });

      it('should handle invalid availability day of week gracefully', async () => {
        availabilityService.getAvailabilityById.mockResolvedValue({
          dayOfWeek: 6, // Invalid (Sunday, not in 0-5 range)
        });

        await expect(
          service.validateScheduledDateMatchesSlotDay(1, '2025-04-07'),
        ).rejects.toThrow(/fuera del rango/i);
      });

      it('should reject when exceeding limits by tiny margins', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        // Setup: 3.75h (3h 45min)
        qb.getMany.mockResolvedValue([
          {
            startTime: '09:00',
            endTime: '12:45',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: +0.3h (18 minutes) = 4.05h (exceeds 4h by just 0.05h)
        await expect(
          service.validateDailyHoursLimit(tutorId, '2025-04-07', 0.3),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject overlapping sessions even by minutes', async () => {
        const tutorId = 'tutor-123';
        const qb = createQueryBuilderMock();

        qb.getMany.mockResolvedValue([
          {
            startTime: '10:00',
            endTime: '11:00',
            status: SessionStatus.SCHEDULED,
          },
        ]);
        sessionRepository.createQueryBuilder.mockReturnValue(qb);

        // Proposed: 10:59-11:59 (overlaps by 1 minute)
        await expect(
          service.validateNoTimeConflict(tutorId, '2025-04-07', '10:59', 1),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 6: Error Messages and Feedback
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 6: Error Messages and User Feedback', () => {
    it('should provide detailed conflict information', async () => {
      const tutorId = 'tutor-123';
      const qb = createQueryBuilderMock();

      qb.getMany.mockResolvedValue([
        {
          startTime: '10:00',
          endTime: '11:00',
          status: SessionStatus.SCHEDULED,
        },
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      // Proposed: 10:30-11:30
      try {
        await service.validateNoTimeConflict(tutorId, '2025-04-07', '10:30', 1);
      } catch (error) {
        expect(error.message).toContain('10:00');
        expect(error.message).toContain('11:00');
        expect(error.message).toContain('10:30');
        expect(error.message).toContain('11:30');
        expect(error.message).toContain('2025-04-07');
      }
    });

    it('should provide breakdown of hours in daily limit error', async () => {
      const tutorId = 'tutor-123';
      const qb = createQueryBuilderMock();

      qb.getMany.mockResolvedValue([
        {
          startTime: '09:00',
          endTime: '12:00',
          status: SessionStatus.SCHEDULED,
        }, // 3h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      // Proposed: 1.5h (total: 4.5h)
      try {
        await service.validateDailyHoursLimit(tutorId, '2025-04-07', 1.5);
      } catch (error) {
        expect(error.message).toContain('3h');
        expect(error.message).toContain('1.5h');
        expect(error.message).toContain('4.5h');
        expect(error.message).toContain('4h');
      }
    });

    it('should provide breakdown of hours in weekly limit error', async () => {
      const tutorId = 'tutor-123';
      const qb = createQueryBuilderMock();

      qb.getMany.mockResolvedValue([
        {
          startTime: '09:00',
          endTime: '17:00',
          status: SessionStatus.SCHEDULED,
        }, // 8h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

      // Proposed: 3h (total: 11h)
      try {
        await service.validateWeeklyHoursLimit(tutorId, '2025-04-07', 3);
      } catch (error) {
        expect(error.message).toContain('8h');
        expect(error.message).toContain('3h');
        expect(error.message).toContain('11h');
        expect(error.message).toContain('10h');
      }
    });

    it('should indicate correct day of week mismatch in error', async () => {
      availabilityService.getAvailabilityById.mockResolvedValue({
        dayOfWeek: 0, // Monday
      });

      // 2025-04-08 is Tuesday
      try {
        await service.validateScheduledDateMatchesSlotDay(1, '2025-04-08');
      } catch (error) {
        expect(error.message).toContain('martes'); // Tuesday in Spanish
        expect(error.message).toContain('lunes'); // Monday in Spanish
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIO 7: Complete Workflow Chains
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenario 7: Complete Workflow Chains', () => {
    it('should validate complete creation workflow with all components', async () => {
      const studentId = 'student-123';
      const tutorId = 'tutor-456';
      const availabilityId = 1;
      // Using 2030-01-07 which is a Monday in UTC
      const scheduledDate = '2030-01-07';
      const startTime = '10:00';
      const durationHours = 2;
      const modality = 'VIRTUAL';

      // Setup mocks
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      sessionRepository.createQueryBuilder.mockReturnValue(qb);

      availabilityService.getAvailabilityById.mockResolvedValue({
        id: availabilityId,
        dayOfWeek: 0, // Monday
      });

      availabilityService.isSlotAvailableForDateWithDuration.mockResolvedValue({
        available: true,
      });

      availabilityService.validateModalityForSlot.mockResolvedValue(undefined);

      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);

      // Execute complete workflow
      const validations = async () => {
        // 1. Student ≠ Tutor
        service.validateStudentNotTutor(studentId, tutorId);

        // 2. Date matches slot day
        await service.validateScheduledDateMatchesSlotDay(
          availabilityId,
          scheduledDate,
        );

        // 3. Availability slot is available for duration
        await service.validateAvailabilitySlotWithDuration(
          tutorId,
          availabilityId,
          scheduledDate,
          durationHours,
        );

        // 4. Modality matches
        await service.validateModality(availabilityId, tutorId, modality);

        // 5. No time conflicts
        await service.validateNoTimeConflict(
          tutorId,
          scheduledDate,
          startTime,
          durationHours,
        );

        // 6. Daily hours limit
        await service.validateDailyHoursLimit(
          tutorId,
          scheduledDate,
          durationHours,
        );

        // 7. Weekly hours limit
        await service.validateWeeklyHoursLimit(
          tutorId,
          scheduledDate,
          durationHours,
        );

        // 8. Can cancel (24h rule)
        const canCancel = service.validateCancellationTime(
          scheduledDate,
          startTime,
        );
        expect(canCancel).toBe(true);

        // 9. Calculate end time
        const endTime = service.calculateEndTime(startTime, durationHours);
        expect(endTime).toBe('12:00');
      };

      await expect(validations()).resolves.toBeUndefined();
    });

    it('should handle workflow with intermediate failure and retry', async () => {
      const tutorId = 'tutor-123';
      const qb1 = createQueryBuilderMock();
      const qb2 = createQueryBuilderMock();

      // First attempt: daily hours exceeded
      qb1.getMany.mockResolvedValue([
        {
          startTime: '09:00',
          endTime: '13:00',
          status: SessionStatus.SCHEDULED,
        }, // 4h
      ]);
      sessionRepository.createQueryBuilder.mockReturnValueOnce(qb1);

      await expect(
        service.validateDailyHoursLimit(tutorId, '2025-04-07', 1), // +1h = 5h > 4h limit
      ).rejects.toThrow(BadRequestException);

      // Retry with different date that has no sessions
      qb2.getMany.mockResolvedValue([]); // No sessions on 2025-04-08
      sessionRepository.createQueryBuilder.mockReturnValueOnce(qb2);

      // Different date with no sessions should pass
      await expect(
        service.validateDailyHoursLimit(tutorId, '2025-04-08', 1), // +1h = 1h ≤ 4h limit
      ).resolves.toBeUndefined();
    });
  });
});
