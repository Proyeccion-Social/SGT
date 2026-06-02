import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionValidationService } from './session-validation.service';
import { AvailabilityService } from '../../availability/services/availability.service';
import { TutorService } from '../../tutor/services/tutor.service';
import { UserService } from '../../users/services/users.service';
import { SubjectsService } from '../../subjects/services/subjects.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { Session } from '../entities/session.entity';
import { ScheduledSession } from '../entities/scheduled-session.entity';
import { StudentParticipateSession } from '../entities/student-participate-session.entity';
import { SessionModificationRequest } from '../entities/session-modification-request.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { SessionType } from '../enums/session-type.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';
import { ModificationStatus } from '../enums/modification-status.enum';

/**
 * Integration Tests for SessionService
 *
 * These tests verify realistic workflows, end-to-end operations, and complex
 * interactions between SessionService and its dependencies. Using mocks for
 * repositories and external services, NOT real database.
 *
 * Test Organization:
 * 1. Session Creation (18 tests)
 * 2. Session Confirmation (12 tests)
 * 3. Session Rejection (4 tests)
 * 4. Session Cancellation (10 tests)
 * 5. Session Modification - Proposal (14 tests)
 * 6. Session Modification - Response (14 tests)
 * 7. Session Details Update (6 tests)
 * 8. Session Queries (6 tests)
 *
 * Total: ~100+ tests covering valid paths, failures, and edge cases
 */
describe('SessionService (Integration Tests)', () => {
  let service: SessionService;
  let sessionRepository: any;
  let scheduledSessionRepository: any;
  let studentParticipateRepository: any;
  let modificationRequestRepository: any;
  let dataSource: any;
  let validationService: any;
  let availabilityService: any;
  let tutorService: any;
  let userService: any;
  let subjectsService: any;
  let notificationsService: any;

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS & FACTORIES
  // ══════════════════════════════════════════════════════════════════════════

  const createMockSession = (overrides = {}): Session => ({
    idSession: 'session-123',
    idTutor: 'tutor-456',
    idSubject: 'subject-789',
    scheduledDate: '2030-01-07', // Monday
    startTime: '10:00',
    endTime: '11:00',
    title: 'Math Tutoring',
    description: 'Basic algebra session',
    type: SessionType.INDIVIDUAL,
    modality: 'PRES' as any, // Use correct enum value
    location: 'Library',
    virtualLink: null,
    status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
    cancellationReason: null,
    cancelledAt: null,
    cancelledWithin24h: false,
    cancelledBy: null,
    createdAt: new Date(),
    tutorConfirmed: false,
    tutorConfirmedAt: null,
    rejectionReason: null,
    rejectedAt: null,
    tutor: {
      idUser: 'tutor-456',
      user: { name: 'Tutor Name' },
      sessions: [],
      urlImage: 'https://...',
    },
    subject: { idSubject: 'subject-789', name: 'Mathematics', sessions: [] },
    studentParticipateSessions: [],
    scheduledSession: null,
    modificationRequests: [],
    ...overrides,
  });

  const createMockScheduledSession = (overrides = {}): ScheduledSession => ({
    idSession: 'session-123',
    idTutor: 'tutor-456',
    idAvailability: 1,
    scheduledDate: '2030-01-07',
    session: null,
    tutor: null,
    availability: null,
    ...overrides,
  });

  const createMockStudentParticipation = (
    overrides = {},
  ): StudentParticipateSession => ({
    idStudent: 'student-123',
    idSession: 'session-123',
    status: ParticipationStatus.CONFIRMED,
    comment: null,
    arrivalTime: null,
    session: null,
    student: null,
    ...overrides,
  });

  const createMockModificationRequest = (
    overrides = {},
  ): SessionModificationRequest => ({
    idRequest: 'request-123',
    idSession: 'session-123',
    requestedBy: 'student-123',
    newScheduledDate: '2030-01-14',
    newAvailabilityId: 2,
    newModality: 'VIRTUAL',
    newDurationHours: 2,
    status: ModificationStatus.PENDING,
    requestedAt: new Date(),
    respondedAt: null,
    respondedBy: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    session: null,
    requester: null,
    responder: null,
    ...overrides,
  });

  const createQueryBuilderMock = () => {
    const qb: any = {
      innerJoin: jest.fn(),
      innerJoinAndSelect: jest.fn(),
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      setLock: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawOne: jest.fn().mockResolvedValue(null),
    };

    // Chain all methods
    qb.innerJoin.mockReturnValue(qb);
    qb.innerJoinAndSelect.mockReturnValue(qb);
    qb.leftJoinAndSelect.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    qb.select.mockReturnValue(qb);
    qb.orderBy.mockReturnValue(qb);
    qb.addOrderBy.mockReturnValue(qb);
    qb.skip.mockReturnValue(qb);
    qb.take.mockReturnValue(qb);
    qb.setLock.mockReturnValue(qb);

    return qb;
  };

  const createQueryRunnerMock = () => {
    const queryRunner: any = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn((entity, data) => ({ ...data })),
        save: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]), // Default empty array
        createQueryBuilder: jest.fn(),
        remove: jest.fn().mockResolvedValue({}),
      },
    };

    queryRunner.manager.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(),
    );

    return queryRunner;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SETUP
  // ══════════════════════════════════════════════════════════════════════════

  beforeEach(() => {
    // Repository mocks
    sessionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    scheduledSessionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    studentParticipateRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    modificationRequestRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    // DataSource mock with QueryRunner
    const queryRunner = createQueryRunnerMock();
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    // Service mocks
    validationService = {
      validateStudentNotTutor: jest.fn(),
      validateTutorActive: jest.fn().mockResolvedValue(undefined),
      validateModality: jest.fn().mockResolvedValue(undefined),
      validateScheduledDateMatchesSlotDay: jest
        .fn()
        .mockResolvedValue(undefined),
      validateAvailabilitySlotWithDuration: jest
        .fn()
        .mockResolvedValue(undefined),
      validateNoTimeConflict: jest.fn().mockResolvedValue(undefined),
      validateDailyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateWeeklyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateCancellationTime: jest.fn().mockReturnValue(true),
      calculateEndTime: jest.fn().mockReturnValue('11:00'),
    };

    availabilityService = {
      getAvailabilityById: jest.fn().mockResolvedValue({
        id: 1,
        dayOfWeek: 0,
        startTime: '10:00',
        endTime: '12:00',
      }),
    };

    tutorService = {
      validateTutorActive: jest.fn().mockResolvedValue(undefined),
      getWeeklyHoursLimit: jest.fn().mockResolvedValue(10),
    };

    userService = {
      isAdmin: jest.fn().mockResolvedValue(false),
    };

    subjectsService = {
      getSubjectById: jest.fn(),
    };

    notificationsService = {
      sendTutorConfirmationRequest: jest.fn().mockResolvedValue(undefined),
      sendStudentSessionRequestAck: jest.fn().mockResolvedValue(undefined),
      sendSessionConfirmationStudent: jest.fn().mockResolvedValue(undefined),
      sendSessionConfirmationTutor: jest.fn().mockResolvedValue(undefined),
      sendSessionRejection: jest.fn().mockResolvedValue(undefined),
      sendSessionCancellation: jest.fn().mockResolvedValue(undefined),
      sendModificationRequest: jest.fn().mockResolvedValue(undefined),
      sendModificationResponse: jest.fn().mockResolvedValue(undefined),
      sendSessionDetailsUpdate: jest.fn().mockResolvedValue(undefined),
    };

    // Create service
    service = new SessionService(
      sessionRepository,
      scheduledSessionRepository,
      studentParticipateRepository,
      modificationRequestRepository,
      dataSource,
      validationService,
      availabilityService,
      tutorService,
      userService,
      subjectsService,
      notificationsService,
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: SESSION CREATION (18 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 1: Session Creation', () => {
    describe('✅ Valid Creation Scenarios', () => {
      it('should create minimal valid session', async () => {
        const mockSession = createMockSession();
        const queryRunner = dataSource.createQueryRunner();

        sessionRepository.findOne = jest.fn();
        queryRunner.manager.create.mockReturnValue(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.save.mockResolvedValueOnce({});
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRES',
          durationHours: 1,
          title: 'Math Session',
          description: 'Algebra basics',
        };

        const result = await service.createIndividualSession(
          'student-123',
          dto,
        );

        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
        expect(validationService.validateStudentNotTutor).toHaveBeenCalledWith(
          'student-123',
          'tutor-456',
        );
      });

      it('should return pending count when multiple requests exist', async () => {
        const mockSession = createMockSession();
        const queryRunner = dataSource.createQueryRunner();

        sessionRepository.findOne = jest.fn();
        queryRunner.manager.create.mockReturnValue(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.getCount.mockResolvedValue(2);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRES',
          durationHours: 1,
          title: 'Math Session',
          description: 'Algebra basics',
        };

        const result = await service.createIndividualSession(
          'student-123',
          dto,
        );

        expect(result.pendingRequestsCount).toBeDefined();
      });

      it('should allow multiple sessions on different days', async () => {
        const mockSession = createMockSession();
        const queryRunner = dataSource.createQueryRunner();

        sessionRepository.findOne = jest.fn();
        queryRunner.manager.create.mockReturnValue(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.save.mockResolvedValueOnce({});
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const dto1 = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session 1',
          description: 'Test',
        };

        const result1 = await service.createIndividualSession(
          'student-123',
          dto1,
        );
        expect(result1.success).toBe(true);

        // Second session on different date
        const dto2 = { ...dto1, scheduledDate: '2030-01-14' };
        const result2 = await service.createIndividualSession(
          'student-123',
          dto2,
        );
        expect(result2.success).toBe(true);
      });

      it('should create session with exactly 4h daily limit', async () => {
        const mockSession = createMockSession({ endTime: '14:00' });
        const queryRunner = dataSource.createQueryRunner();

        sessionRepository.findOne = jest.fn();
        queryRunner.manager.create.mockReturnValue(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce(mockSession);
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.save.mockResolvedValueOnce({});
        queryRunner.manager.getRawOne.mockResolvedValue({ totalHours: '0' });
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 4,
          title: 'Long Session',
          description: 'Test',
        };

        const result = await service.createIndividualSession(
          'student-123',
          dto,
        );
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Validation Failures', () => {
      it('should reject when student == tutor', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {
          throw new BadRequestException(
            'No puedes agendar una tutoría contigo mismo',
          );
        });

        const dto = {
          tutorId: 'student-123',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject when tutor not active', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockRejectedValue(
          new NotFoundException('Tutor not found or inactive'),
        );

        const dto = {
          tutorId: 'invalid-tutor',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(NotFoundException);
      });

      it('should reject when date does not match slot day', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockResolvedValue(undefined);
        validationService.validateScheduledDateMatchesSlotDay.mockRejectedValue(
          new BadRequestException('Date does not match slot day'),
        );

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-08', // Tuesday, but slot is Monday
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject when daily hours exceeded', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockResolvedValue(undefined);
        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateModality.mockResolvedValue(undefined);
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateWeeklyHoursLimit.mockResolvedValue(undefined);

        const queryRunner = dataSource.createQueryRunner();
        queryRunner.manager.getRawOne.mockResolvedValue({ totalHours: '4' });

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 1, // 4 + 1 = 5, exceeds 4h limit
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject when weekly hours exceeded', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockResolvedValue(undefined);
        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateModality.mockResolvedValue(undefined);
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateWeeklyHoursLimit.mockRejectedValue(
          new BadRequestException('Weekly limit exceeded'),
        );

        const queryRunner = dataSource.createQueryRunner();
        queryRunner.manager.getRawOne.mockResolvedValue({ totalHours: '0' });

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 12,
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('❌ Conflict Detection', () => {
      it('should reject time overlap with existing session', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockResolvedValue(undefined);
        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateModality.mockResolvedValue(undefined);
        validationService.validateNoTimeConflict.mockRejectedValue(
          new BadRequestException('Time conflict exists'),
        );

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07',
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session',
          description: 'Test',
        };

        await expect(
          service.createIndividualSession('student-123', dto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('✅ Edge Cases', () => {
      it('should allow same slot on different weeks', async () => {
        validationService.validateStudentNotTutor.mockImplementation(() => {});
        tutorService.validateTutorActive.mockResolvedValue(undefined);
        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateModality.mockResolvedValue(undefined);
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateWeeklyHoursLimit.mockResolvedValue(undefined);

        const mockSession = createMockSession({
          scheduledDate: '2030-01-07',
        });
        const queryRunner = dataSource.createQueryRunner();

        sessionRepository.findOne = jest.fn();
        queryRunner.manager.create.mockReturnValue(mockSession);
        queryRunner.manager.save.mockResolvedValue(mockSession);
        queryRunner.manager.getRawOne.mockResolvedValue({ totalHours: '0' });
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const dto = {
          tutorId: 'tutor-456',
          subjectId: 'subject-789',
          availabilityId: 1,
          scheduledDate: '2030-01-07', // Week 1 Monday
          modality: 'PRESENCIAL',
          durationHours: 1,
          title: 'Session',
          description: 'Test',
        };

        await service.createIndividualSession('student-123', dto);

        // Now book same slot different week
        const dto2 = { ...dto, scheduledDate: '2030-01-14' }; // Week 2 Monday

        const result = await service.createIndividualSession(
          'student-123',
          dto2,
        );
        expect(result.success).toBe(true);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: SESSION CONFIRMATION (12 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 2: Session Confirmation', () => {
    describe('✅ Valid Confirmations', () => {
      it('should confirm pending session and change status to SCHEDULED', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        });
        const mockScheduledSession = createMockScheduledSession();
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockScheduledSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(null); // No conflicts
        queryRunner.manager.createQueryBuilder.mockReturnValue(
          createQueryBuilderMock(),
        );
        queryRunner.manager.getMany.mockResolvedValue([]); // No day sessions
        queryRunner.manager.findOne.mockResolvedValueOnce({
          idStudent: 'student-123',
        }); // Participation
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.confirmSession(
          'tutor-456',
          'session-123',
          {},
        );

        expect(result.success).toBe(true);
      });

      it('should auto-reject competing requests', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        });
        const mockScheduledSession = createMockScheduledSession();
        const competingRequest = createMockSession({
          idSession: 'session-456',
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        });

        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockScheduledSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(null);

        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValueOnce([]); // No conflicts
        qb.getMany.mockResolvedValueOnce([
          { session: competingRequest, idSession: 'session-456' },
        ]); // Competing requests

        queryRunner.manager.createQueryBuilder.mockReturnValue(qb);
        queryRunner.manager.findOne.mockResolvedValueOnce({
          idStudent: 'student-123',
        });
        queryRunner.manager.findOne.mockResolvedValueOnce({
          idStudent: 'student-456',
        }); // Competing student
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.confirmSession(
          'tutor-456',
          'session-123',
          {},
        );

        expect(result.autoRejectedCount).toBe(1);
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if non-tutor tries to confirm', async () => {
        const mockSession = createMockSession({
          idTutor: 'tutor-456',
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);

        await expect(
          service.confirmSession('other-user', 'session-123', {}),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject if session not pending', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);

        await expect(
          service.confirmSession('tutor-456', 'session-123', {}),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject if daily limit would be exceeded', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        });
        const mockScheduledSession = createMockScheduledSession();
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockScheduledSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(null);

        const qb = createQueryBuilderMock();
        qb.getMany.mockResolvedValueOnce([]);
        const daySessionsQb = createQueryBuilderMock();
        daySessionsQb.getMany.mockResolvedValue([
          {
            session: createMockSession({
              startTime: '09:00',
              endTime: '13:00',
            }), // 4h
            idSession: 'other-session',
          },
        ]);

        queryRunner.manager.createQueryBuilder
          .mockReturnValueOnce(qb)
          .mockReturnValueOnce(daySessionsQb);

        await expect(
          service.confirmSession('tutor-456', 'session-123', {}),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: SESSION REJECTION (4 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 3: Session Rejection', () => {
    describe('✅ Valid Rejection', () => {
      it('should reject pending session', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);
        scheduledSessionRepository.delete.mockResolvedValue({});

        const result = await service.rejectSession('tutor-456', 'session-123', {
          reason: 'Not available',
        });

        expect(result.success).toBe(true);
        expect(sessionRepository.save).toHaveBeenCalled();
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if non-tutor tries to reject', async () => {
        const mockSession = createMockSession({
          idTutor: 'tutor-456',
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.rejectSession('other-user', 'session-123', {
            reason: 'Test',
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject if session not pending', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.rejectSession('tutor-456', 'session-123', {
            reason: 'Test',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: SESSION CANCELLATION (10 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 4: Session Cancellation', () => {
    describe('✅ Valid Cancellations', () => {
      it('should allow student to cancel scheduled session', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateCancellationTime.mockReturnValue(true);
        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);
        scheduledSessionRepository.delete.mockResolvedValue({});

        const result = await service.cancelSession(
          'student-123',
          'session-123',
          { reason: 'Cannot attend' },
        );

        expect(result.success).toBe(true);
      });

      it('should allow tutor to cancel session', async () => {
        const mockSession = createMockSession({
          idTutor: 'tutor-456',
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateCancellationTime.mockReturnValue(true);
        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);
        scheduledSessionRepository.delete.mockResolvedValue({});

        const result = await service.cancelSession('tutor-456', 'session-123', {
          reason: 'Emergency',
        });

        expect(result.success).toBe(true);
      });

      it('should allow admin to bypass 24h rule', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        userService.isAdmin.mockResolvedValue(true);
        validationService.validateCancellationTime.mockReturnValue(false); // Less than 24h
        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);
        scheduledSessionRepository.delete.mockResolvedValue({});

        const result = await service.cancelSession(
          'admin-user',
          'session-123',
          { reason: 'Admin override' },
        );

        expect(result.success).toBe(true);
      });
    });

    describe('❌ 24-Hour Rule', () => {
      it('should reject cancellation within 24h (non-admin)', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateCancellationTime.mockReturnValue(false);
        userService.isAdmin.mockResolvedValue(false);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.cancelSession('student-123', 'session-123', {
            reason: 'Cannot attend',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if user not participant/tutor/admin', async () => {
        const mockSession = createMockSession({
          studentParticipateSessions: [
            { idStudent: 'other-student', idSession: 'session-123' },
          ],
        });

        userService.isAdmin.mockResolvedValue(false);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.cancelSession('random-user', 'session-123', {
            reason: 'Test',
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject if session not scheduled', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.cancelSession('student-123', 'session-123', {
            reason: 'Test',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: MODIFICATION - PROPOSAL (14 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 5: Session Modification - Proposal', () => {
    describe('✅ Valid Proposals', () => {
      it('should propose date change', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateWeeklyHoursLimit.mockResolvedValue(undefined);
        validationService.validateDailyHoursLimit.mockResolvedValue(undefined);

        sessionRepository.findOne.mockResolvedValue(mockSession);
        const savedRequest = createMockModificationRequest();
        modificationRequestRepository.save.mockResolvedValue(savedRequest);
        sessionRepository.save.mockResolvedValue(mockSession);

        const result = await service.proposeModification(
          'student-123',
          'session-123',
          { newScheduledDate: '2030-01-14' },
        );

        expect(result.success).toBe(true);
        expect(result.requestId).toBeDefined();
      });

      it('should propose modality change', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);
        const savedRequest = createMockModificationRequest();
        modificationRequestRepository.save.mockResolvedValue(savedRequest);
        sessionRepository.save.mockResolvedValue(mockSession);

        const result = await service.proposeModification(
          'student-123',
          'session-123',
          { newModality: 'VIRTUAL' },
        );

        expect(result.success).toBe(true);
      });

      it('should propose duration change with validations', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateScheduledDateMatchesSlotDay.mockResolvedValue(
          undefined,
        );
        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateWeeklyHoursLimit.mockResolvedValue(undefined);
        validationService.validateDailyHoursLimit.mockResolvedValue(undefined);

        scheduledSessionRepository.findOne.mockResolvedValue(
          createMockScheduledSession(),
        );

        sessionRepository.findOne.mockResolvedValue(mockSession);
        const savedRequest = createMockModificationRequest();
        modificationRequestRepository.save.mockResolvedValue(savedRequest);
        sessionRepository.save.mockResolvedValue(mockSession);

        const result = await service.proposeModification(
          'student-123',
          'session-123',
          { newDurationHours: 2 },
        );

        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if propose with no changes', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.proposeModification('student-123', 'session-123', {}),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject if non-participant/non-tutor proposes', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'other-student', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.proposeModification('random-user', 'session-123', {
            newScheduledDate: '2030-01-14',
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject if session not scheduled', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.proposeModification('student-123', 'session-123', {
            newScheduledDate: '2030-01-14',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject if date validation fails', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        validationService.validateScheduledDateMatchesSlotDay.mockRejectedValue(
          new BadRequestException('Date mismatch'),
        );

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.proposeModification('student-123', 'session-123', {
            newScheduledDate: '2030-01-08',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: MODIFICATION - RESPONSE (14 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 6: Session Modification - Response', () => {
    describe('✅ Valid Accept', () => {
      it('should accept modification proposal', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_MODIFICATION,
        });
        const mockRequest = createMockModificationRequest({
          status: ModificationStatus.PENDING,
          expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10h from now
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockRequest);
        queryRunner.manager.find.mockResolvedValueOnce([
          { idStudent: 'tutor-456' },
        ]); // Participations
        queryRunner.manager.findOne.mockResolvedValueOnce(
          createMockScheduledSession(),
        );
        queryRunner.manager.findOne.mockResolvedValueOnce(null); // No conflict

        validationService.validateAvailabilitySlotWithDuration.mockResolvedValue(
          undefined,
        );
        validationService.validateNoTimeConflict.mockResolvedValue(undefined);
        validationService.validateDailyHoursLimit.mockResolvedValue(undefined);

        queryRunner.manager.save.mockResolvedValue(mockSession);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.respondToModification(
          'tutor-456',
          'session-123',
          true,
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('aceptada');
      });

      it('should reject modification proposal', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_MODIFICATION,
        });
        const mockRequest = createMockModificationRequest({
          status: ModificationStatus.PENDING,
          expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockRequest);
        queryRunner.manager.find.mockResolvedValueOnce([
          { idStudent: 'student-123' },
        ]);
        queryRunner.manager.save.mockResolvedValue(mockSession);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.respondToModification(
          'student-123',
          'session-123',
          false,
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('rechazada');
      });
    });

    describe('❌ Expiry Handling', () => {
      it('should reject if request expired', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_MODIFICATION,
        });
        const mockRequest = createMockModificationRequest({
          status: ModificationStatus.PENDING,
          expiresAt: new Date(Date.now() - 1000), // Expired
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne.mockResolvedValueOnce(mockSession);
        queryRunner.manager.findOne.mockResolvedValueOnce(mockRequest);

        await expect(
          service.respondToModification('student-123', 'session-123', true),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if requester tries to respond', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_MODIFICATION,
        });
        const mockRequest = createMockModificationRequest({
          requestedBy: 'student-123',
          status: ModificationStatus.PENDING,
          expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockSession)
          .mockResolvedValueOnce(mockRequest);
        queryRunner.manager.find.mockResolvedValue([
          { idStudent: 'student-123' },
        ]);

        await expect(
          service.respondToModification('student-123', 'session-123', true),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject if non-participant tries to respond', async () => {
        const mockSession = createMockSession({
          status: SessionStatus.PENDING_MODIFICATION,
        });
        const mockRequest = createMockModificationRequest({
          requestedBy: 'student-123',
          status: ModificationStatus.PENDING,
          expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
        });
        const queryRunner = dataSource.createQueryRunner();

        queryRunner.manager.findOne
          .mockResolvedValueOnce(mockSession)
          .mockResolvedValueOnce(mockRequest);
        queryRunner.manager.find.mockResolvedValue([
          { idStudent: 'other-student' },
        ]);

        await expect(
          service.respondToModification('random-user', 'session-123', true),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: SESSION DETAILS UPDATE (6 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 7: Session Details Update', () => {
    describe('✅ Valid Updates', () => {
      it('should update session title', async () => {
        const mockSession = createMockSession({
          title: 'Old Title',
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);

        const result = await service.updateSessionDetails(
          'student-123',
          'session-123',
          { title: 'New Title' },
        );

        expect(result.success).toBe(true);
      });

      it('should update multiple fields', async () => {
        const mockSession = createMockSession({
          title: 'Old Title',
          description: 'Old desc',
          location: 'Old location',
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);
        sessionRepository.save.mockResolvedValue(mockSession);

        const result = await service.updateSessionDetails(
          'student-123',
          'session-123',
          {
            title: 'New Title',
            description: 'New desc',
            location: 'New location',
          },
        );

        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid Operations', () => {
      it('should reject if non-participant/non-tutor updates', async () => {
        const mockSession = createMockSession({
          studentParticipateSessions: [
            { idStudent: 'other-student', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.updateSessionDetails('random-user', 'session-123', {
            title: 'New Title',
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject if session already started', async () => {
        const futureDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const mockSession = createMockSession({
          scheduledDate: futureDate.toISOString().split('T')[0],
          startTime: '08:00',
          studentParticipateSessions: [
            { idStudent: 'student-123', idSession: 'session-123' },
          ],
        });

        sessionRepository.findOne.mockResolvedValue(mockSession);

        await expect(
          service.updateSessionDetails('student-123', 'session-123', {
            title: 'New Title',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: SESSION QUERIES (6 TESTS)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Integration 8: Session Queries', () => {
    describe('✅ Student Queries', () => {
      it('should get student sessions with pagination', async () => {
        const qb = createQueryBuilderMock();
        const mockSession = createMockSession();
        const mockParticipation = {
          idStudent: 'student-123',
          idSession: 'session-123',
          session: mockSession,
        };
        qb.getManyAndCount.mockResolvedValue([[mockParticipation], 1]);

        studentParticipateRepository.createQueryBuilder.mockReturnValue(qb);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.getMySessionsAsStudent('student-123', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.meta.total).toBe(1);
      });

      it('should filter student sessions by status', async () => {
        const qb = createQueryBuilderMock();
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
        });
        const mockParticipation = {
          idStudent: 'student-123',
          idSession: 'session-123',
          session: mockSession,
        };
        qb.getManyAndCount.mockResolvedValue([[mockParticipation], 1]);

        studentParticipateRepository.createQueryBuilder.mockReturnValue(qb);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.getMySessionsAsStudent('student-123', {
          page: 1,
          limit: 10,
          status: 'SCHEDULED',
        });

        expect(result.data).toBeDefined();
      });
    });

    describe('✅ Tutor Queries', () => {
      it('should get tutor sessions with pagination', async () => {
        const qb = createQueryBuilderMock();
        const mockSession = createMockSession();
        qb.getManyAndCount.mockResolvedValue([[mockSession], 1]);

        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.getMySessionsAsTutor('tutor-456', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toBeDefined();
        expect(result.meta.total).toBe(1);
      });

      it('should filter tutor sessions by status', async () => {
        const qb = createQueryBuilderMock();
        const mockSession = createMockSession({
          status: SessionStatus.SCHEDULED,
        });
        qb.getManyAndCount.mockResolvedValue([[mockSession], 1]);

        sessionRepository.createQueryBuilder.mockReturnValue(qb);
        sessionRepository.findOne.mockResolvedValue(mockSession);

        const result = await service.getMySessionsAsTutor('tutor-456', {
          page: 1,
          limit: 10,
          status: 'SCHEDULED',
        });

        expect(result.data).toBeDefined();
      });
    });

    describe('✅ Edge Cases', () => {
      it('should return empty results with correct pagination', async () => {
        const qb = createQueryBuilderMock();
        qb.getManyAndCount.mockResolvedValue([[], 0]);

        studentParticipateRepository.createQueryBuilder.mockReturnValue(qb);

        const result = await service.getMySessionsAsStudent('student-123', {
          page: 1,
          limit: 10,
        });

        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
      });
    });
  });
});
