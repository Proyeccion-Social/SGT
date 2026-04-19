import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionStatus } from '../enums/session-status.enum';
import { ModificationStatus } from '../enums/modification-status.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';

// ─── QueryBuilder factory ─────────────────────────────────────────────────────
// Returns a chainable QB mock; terminalFn is the method that resolves with value.
const makeQb = (
  terminalFn:
    | 'getOne'
    | 'getMany'
    | 'getCount'
    | 'getManyAndCount'
    | 'getRawOne'
    | 'getRawMany',
  value: any,
) => {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb[terminalFn].mockResolvedValue(value);
  return qb;
};

describe('SessionService', () => {
  let service: SessionService;

  // ─── Repository / DataSource mocks ───────────────────────────────────────────
  let sessionRepository: any;
  let scheduledSessionRepository: any;
  let studentParticipateRepository: any;
  let modificationRequestRepository: any;
  let dataSource: any;
  let managerMock: any;
  let queryRunnerMock: any;

  // ─── Service mocks ────────────────────────────────────────────────────────────
  let validationService: any;
  let availabilityService: any;
  let tutorService: any;
  let userService: any;
  let subjectsService: any;
  let notificationsService: any;

  // ─── Shared fixtures ──────────────────────────────────────────────────────────
  const FUTURE_DATE = '2030-12-31';
  const PAST_DATE = '2020-01-01';

  const mockSession = (overrides: Partial<any> = {}): any => ({
    idSession: 'session-1',
    idTutor: 'tutor-1',
    scheduledDate: FUTURE_DATE,
    startTime: '09:00',
    endTime: '10:00',
    modality: 'VIRTUAL',
    status: SessionStatus.SCHEDULED,
    title: 'Math tutoring',
    description: 'desc',
    location: null,
    virtualLink: null,
    tutorConfirmed: true,
    studentParticipateSessions: [
      {
        idStudent: 'student-1',
        status: ParticipationStatus.CONFIRMED,
        student: { idUser: 'student-1', user: { name: 'Alice' } },
      },
    ],
    tutor: { idUser: 'tutor-1', user: { name: 'Bob' }, urlImage: null },
    subject: { idSubject: 'sub-1', name: 'Mathematics' },
    createdAt: new Date(),
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  });

  beforeEach(() => {
    managerMock = {
      create: jest.fn((_, data) => ({ ...data })),
      save: jest.fn(async (e) => ({ ...e, idSession: 'session-1' })),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: managerMock,
    };

    sessionRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (e) => e),
      createQueryBuilder: jest.fn(),
    };
    scheduledSessionRepository = {
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    studentParticipateRepository = {
      createQueryBuilder: jest.fn(),
    };
    modificationRequestRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (e) => ({ ...e, idRequest: 'req-1' })),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    validationService = {
      validateStudentNotTutor: jest.fn().mockResolvedValue(undefined),
      validateModality: jest.fn().mockResolvedValue(undefined),
      validateScheduledDateMatchesSlotDay: jest
        .fn()
        .mockResolvedValue(undefined),
      validateAvailabilitySlotWithDuration: jest
        .fn()
        .mockResolvedValue(undefined),
      validateNoTimeConflict: jest.fn().mockResolvedValue(undefined),
      validateWeeklyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateDailyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateCancellationTime: jest.fn().mockReturnValue(true),
      calculateEndTime: jest.fn().mockReturnValue('10:00'),
    };
    availabilityService = {
      getAvailabilityById: jest
        .fn()
        .mockResolvedValue({ startTime: '09:00', dayOfWeek: 0 }),
    };
    tutorService = {
      validateTutorActive: jest.fn().mockResolvedValue(undefined),
    };
    userService = {
      isAdmin: jest.fn().mockResolvedValue(false),
    };
    subjectsService = {};
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

  // ═══════════════════════════════════════════════════════════════════════════
  // rejectSession
  // ═══════════════════════════════════════════════════════════════════════════

  describe('rejectSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.rejectSession('tutor-1', 'session-1', { reason: 'busy' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when tutor does not own the session', async () => {
      sessionRepository.findOne.mockResolvedValue(
        mockSession({ status: SessionStatus.PENDING_TUTOR_CONFIRMATION }),
      );

      await expect(
        service.rejectSession('other-tutor', 'session-1', { reason: 'busy' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not PENDING_TUTOR_CONFIRMATION', async () => {
      sessionRepository.findOne.mockResolvedValue(
        mockSession({ status: SessionStatus.SCHEDULED }),
      );

      await expect(
        service.rejectSession('tutor-1', 'session-1', { reason: 'busy' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets status to REJECTED_BY_TUTOR and deletes scheduled session', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });
      sessionRepository.findOne.mockResolvedValue(session);
      scheduledSessionRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.rejectSession('tutor-1', 'session-1', {
        reason: 'busy',
      });

      expect(session.status).toBe(SessionStatus.REJECTED_BY_TUTOR);
      expect(session.rejectionReason).toBe('busy');
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(scheduledSessionRepository.delete).toHaveBeenCalledWith({
        idSession: 'session-1',
      });
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancelSession
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelSession('student-1', 'session-1', {
          reason: 'plans changed',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not participant, tutor, nor admin', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());
      userService.isAdmin.mockResolvedValue(false);

      await expect(
        service.cancelSession('unrelated-user', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when session is not SCHEDULED', async () => {
      sessionRepository.findOne.mockResolvedValue(
        mockSession({ status: SessionStatus.COMPLETED }),
      );

      await expect(
        service.cancelSession('student-1', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cancelling within 24h (non-admin)', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());
      validationService.validateCancellationTime.mockReturnValue(false); // < 24h

      await expect(
        service.cancelSession('student-1', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows admin to cancel within 24h', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());
      validationService.validateCancellationTime.mockReturnValue(false); // < 24h
      userService.isAdmin.mockResolvedValue(true);
      scheduledSessionRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.cancelSession('admin-1', 'session-1', {
        reason: 'admin',
      });

      expect(result.success).toBe(true);
    });

    it('sets CANCELLED_BY_STUDENT when a participant cancels', async () => {
      const session = mockSession();
      sessionRepository.findOne.mockResolvedValue(session);
      scheduledSessionRepository.delete.mockResolvedValue({ affected: 1 });

      await service.cancelSession('student-1', 'session-1', { reason: 'x' });

      expect(session.status).toBe(SessionStatus.CANCELLED_BY_STUDENT);
      expect(session.cancelledBy).toBe('student-1');
    });

    it('sets CANCELLED_BY_TUTOR when the tutor cancels', async () => {
      const session = mockSession({
        studentParticipateSessions: [
          { idStudent: 'student-1', status: ParticipationStatus.CONFIRMED },
        ],
      });
      sessionRepository.findOne.mockResolvedValue(session);
      scheduledSessionRepository.delete.mockResolvedValue({ affected: 1 });

      await service.cancelSession('tutor-1', 'session-1', { reason: 'x' });

      expect(session.status).toBe(SessionStatus.CANCELLED_BY_TUTOR);
    });

    it('sets cancelledWithin24h=true when admin cancels within 24h', async () => {
      const session = mockSession();
      sessionRepository.findOne.mockResolvedValue(session);
      validationService.validateCancellationTime.mockReturnValue(false);
      userService.isAdmin.mockResolvedValue(true);
      scheduledSessionRepository.delete.mockResolvedValue({ affected: 1 });

      await service.cancelSession('admin-1', 'session-1', { reason: 'x' });

      expect(session.cancelledWithin24h).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // proposeModification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('proposeModification', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.proposeModification('student-1', 'session-1', {
          newScheduledDate: '2030-12-30',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is neither participant nor tutor', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());

      await expect(
        service.proposeModification('unrelated-user', 'session-1', {
          newScheduledDate: '2030-12-30',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when session is not SCHEDULED', async () => {
      sessionRepository.findOne.mockResolvedValue(
        mockSession({ status: SessionStatus.PENDING_MODIFICATION }),
      );

      await expect(
        service.proposeModification('student-1', 'session-1', {
          newScheduledDate: '2030-12-30',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no changes are proposed', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());

      await expect(
        service.proposeModification('student-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates modification request and sets session to PENDING_MODIFICATION', async () => {
      const session = mockSession();
      sessionRepository.findOne.mockResolvedValue(session);
      scheduledSessionRepository.findOne.mockResolvedValue({
        idSession: 'session-1',
        idAvailability: 1,
      });

      const result = await service.proposeModification(
        'student-1',
        'session-1',
        { newScheduledDate: '2030-12-30' },
      );

      expect(session.status).toBe(SessionStatus.PENDING_MODIFICATION);
      expect(modificationRequestRepository.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('sets modification request expiry to 1 day from now', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());
      scheduledSessionRepository.findOne.mockResolvedValue({
        idAvailability: 1,
      });

      const before = new Date();
      await service.proposeModification('student-1', 'session-1', {
        newScheduledDate: '2030-12-30',
      });
      const after = new Date();

      const savedRequest = modificationRequestRepository.save.mock.calls[0][0];
      const expiryMs = savedRequest.expiresAt.getTime();
      expect(expiryMs).toBeGreaterThanOrEqual(
        before.getTime() + 23 * 60 * 60 * 1000,
      );
      expect(expiryMs).toBeLessThanOrEqual(
        after.getTime() + 25 * 60 * 60 * 1000,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateSessionDetails
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateSessionDetails', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSessionDetails('student-1', 'session-1', {
          title: 'New title',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is neither participant nor tutor', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());

      await expect(
        service.updateSessionDetails('unrelated-user', 'session-1', {
          title: 'New title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the session has already started', async () => {
      sessionRepository.findOne.mockResolvedValue(
        mockSession({ scheduledDate: PAST_DATE, startTime: '09:00' }),
      );

      await expect(
        service.updateSessionDetails('student-1', 'session-1', {
          title: 'New',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when title is explicitly set to null', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession());

      await expect(
        service.updateSessionDetails('student-1', 'session-1', { title: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates title and saves the session', async () => {
      const session = mockSession();
      sessionRepository.findOne.mockResolvedValue(session);

      const result = await service.updateSessionDetails(
        'student-1',
        'session-1',
        { title: 'Updated title' },
      );

      expect(session.title).toBe('Updated title');
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('does not include unchanged fields in the change notification', async () => {
      const session = mockSession({ title: 'Same title' });
      sessionRepository.findOne.mockResolvedValue(session);

      await service.updateSessionDetails('student-1', 'session-1', {
        title: 'Same title',
      });

      const changes =
        notificationsService.sendSessionDetailsUpdate.mock.calls[0][1];
      const titleChange = changes.find((c: any) => c.label === 'Título');
      expect(titleChange).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // respondToModification — transaction-based
  // ═══════════════════════════════════════════════════════════════════════════

  describe('respondToModification', () => {
    const pendingRequest = (overrides: Partial<any> = {}): any => ({
      idRequest: 'req-1',
      idSession: 'session-1',
      requestedBy: 'student-1',
      status: ModificationStatus.PENDING,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // not expired
      newScheduledDate: undefined,
      newAvailabilityId: undefined,
      newDurationHours: undefined,
      newModality: undefined,
      ...overrides,
    });

    it('throws NotFoundException when session does not exist', async () => {
      managerMock.findOne.mockResolvedValueOnce(null); // session not found

      await expect(
        service.respondToModification('tutor-1', 'session-1', true),
      ).rejects.toThrow(NotFoundException);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when no pending modification request exists', async () => {
      managerMock.findOne
        .mockResolvedValueOnce(
          mockSession({ status: SessionStatus.PENDING_MODIFICATION }),
        ) // session
        .mockResolvedValueOnce(null); // no pending request

      await expect(
        service.respondToModification('tutor-1', 'session-1', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is neither participant nor tutor', async () => {
      managerMock.findOne
        .mockResolvedValueOnce(
          mockSession({ status: SessionStatus.PENDING_MODIFICATION }),
        )
        .mockResolvedValueOnce(pendingRequest());
      managerMock.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]); // participations

      await expect(
        service.respondToModification('unrelated-user', 'session-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when user tries to respond to their own request', async () => {
      managerMock.findOne
        .mockResolvedValueOnce(
          mockSession({ status: SessionStatus.PENDING_MODIFICATION }),
        )
        .mockResolvedValueOnce(pendingRequest({ requestedBy: 'tutor-1' })); // tutor made the request
      managerMock.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      await expect(
        service.respondToModification('tutor-1', 'session-1', true), // tutor tries to respond own
      ).rejects.toThrow(BadRequestException);
    });

    it('marks request as EXPIRED and restores SCHEDULED status when request has expired', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = pendingRequest({
        expiresAt: new Date(Date.now() - 1000),
      }); // expired

      managerMock.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(request);
      managerMock.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      await expect(
        service.respondToModification('tutor-1', 'session-1', true),
      ).rejects.toThrow(BadRequestException);

      expect(request.status).toBe(ModificationStatus.EXPIRED);
      expect(session.status).toBe(SessionStatus.SCHEDULED);
    });

    it('rejects modification: sets REJECTED status and restores SCHEDULED session', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = pendingRequest({ requestedBy: 'student-1' });

      managerMock.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(request);
      managerMock.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      const result = await service.respondToModification(
        'tutor-1',
        'session-1',
        false,
      );

      expect(request.status).toBe(ModificationStatus.REJECTED);
      expect(session.status).toBe(SessionStatus.SCHEDULED);
      expect(result.message).toContain('rechazada');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('accepts modification: applies new date and restores SCHEDULED status', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = pendingRequest({
        requestedBy: 'student-1',
        newScheduledDate: '2030-11-15',
      });
      const scheduledSession = {
        idAvailability: 1,
        scheduledDate: FUTURE_DATE,
      };

      managerMock.findOne
        .mockResolvedValueOnce(session) // findOne(Session)
        .mockResolvedValueOnce(request) // findOne(ModificationRequest)
        .mockResolvedValueOnce(scheduledSession); // findOne(ScheduledSession)
      managerMock.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      const result = await service.respondToModification(
        'tutor-1',
        'session-1',
        true,
      );

      expect(session.scheduledDate).toBe('2030-11-15');
      expect(session.status).toBe(SessionStatus.SCHEDULED);
      expect(request.status).toBe(ModificationStatus.ACCEPTED);
      expect(result.message).toContain('aceptada');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // confirmSession — transaction-based
  // ═══════════════════════════════════════════════════════════════════════════

  describe('confirmSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      managerMock.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', null),
      ); // session not found

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(NotFoundException);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException when tutor does not own the session', async () => {
      managerMock.createQueryBuilder.mockReturnValueOnce(
        makeQb(
          'getOne',
          mockSession({ status: SessionStatus.PENDING_TUTOR_CONFIRMATION }),
        ),
      );

      await expect(
        service.confirmSession('other-tutor', 'session-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not PENDING_TUTOR_CONFIRMATION', async () => {
      managerMock.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', mockSession({ status: SessionStatus.SCHEDULED })),
      );

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the slot is already confirmed for another student', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });
      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', session)) // get session
        .mockReturnValueOnce(makeQb('getOne', { idSession: 'other-session' })); // conflicting
      managerMock.findOne.mockResolvedValueOnce({
        idAvailability: 1,
        scheduledDate: FUTURE_DATE,
      });

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms session and auto-rejects zero competitors when slot is free', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });

      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', session)) // get session
        .mockReturnValueOnce(makeQb('getOne', null)) // no conflicting
        .mockReturnValueOnce(makeQb('getMany', [])); // no other pending
      managerMock.findOne
        .mockResolvedValueOnce({
          idAvailability: 1,
          scheduledDate: FUTURE_DATE,
        }) // scheduledSession
        .mockResolvedValueOnce({ idStudent: 'student-1' }); // confirmedParticipation

      // getSessionById call after commit needs sessionRepository
      sessionRepository.findOne.mockResolvedValue(mockSession());

      const result = await service.confirmSession('tutor-1', 'session-1', {});

      expect(session.status).toBe(SessionStatus.SCHEDULED);
      expect(session.tutorConfirmed).toBe(true);
      expect(result.autoRejectedCount).toBe(0);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('auto-rejects competing pending sessions when confirming', async () => {
      const session = mockSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });
      const competitor1 = {
        idSession: 'session-2',
        session: mockSession({
          idSession: 'session-2',
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        }),
      };
      const competitor2 = {
        idSession: 'session-3',
        session: mockSession({
          idSession: 'session-3',
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        }),
      };

      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', session)) // get session
        .mockReturnValueOnce(makeQb('getOne', null)) // no conflicting
        .mockReturnValueOnce(makeQb('getMany', [competitor1, competitor2])); // 2 competing

      managerMock.findOne
        .mockResolvedValueOnce({
          idAvailability: 1,
          scheduledDate: FUTURE_DATE,
        }) // scheduledSession
        // findOne(StudentParticipateSession) for each competitor + confirmed
        .mockResolvedValueOnce({ idStudent: 'student-2' })
        .mockResolvedValueOnce({ idStudent: 'student-3' })
        .mockResolvedValueOnce({ idStudent: 'student-1' });

      sessionRepository.findOne.mockResolvedValue(mockSession());

      const result = await service.confirmSession('tutor-1', 'session-1', {});

      expect(competitor1.session.status).toBe(SessionStatus.REJECTED_BY_TUTOR);
      expect(competitor2.session.status).toBe(SessionStatus.REJECTED_BY_TUTOR);
      expect(result.autoRejectedCount).toBe(2);
      expect(notificationsService.sendSessionRejection).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createIndividualSession — transaction + validations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createIndividualSession', () => {
    const dto: any = {
      tutorId: 'tutor-1',
      availabilityId: 1,
      subjectId: 'sub-1',
      scheduledDate: FUTURE_DATE,
      durationHours: 1,
      modality: 'VIRTUAL',
      title: 'Math',
      description: 'desc',
    };

    const setupHappyPath = () => {
      // No confirmed session in slot, 0 pending
      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', null)) // confirmedInSlot
        .mockReturnValueOnce(makeQb('getCount', 0)); // pendingCount

      // getSessionById after commit uses sessionRepository
      sessionRepository.findOne.mockResolvedValue(mockSession());
    };

    it('runs all domain validations before acquiring locks', async () => {
      setupHappyPath();

      await service.createIndividualSession('student-1', dto);

      expect(validationService.validateStudentNotTutor).toHaveBeenCalledWith(
        'student-1',
        'tutor-1',
      );
      expect(tutorService.validateTutorActive).toHaveBeenCalledWith('tutor-1');
      expect(validationService.validateModality).toHaveBeenCalled();
      expect(
        validationService.validateScheduledDateMatchesSlotDay,
      ).toHaveBeenCalled();
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalled();
      expect(validationService.validateNoTimeConflict).toHaveBeenCalled();
      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalled();
    });

    it('throws BadRequestException when slot is already confirmed (pessimistic lock)', async () => {
      managerMock.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', { idSession: 'other-session' }),
      ); // confirmedInSlot

      await expect(
        service.createIndividualSession('student-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws BadRequestException on DB unique constraint violation (code 23505)', async () => {
      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', null)) // no confirmed
        .mockReturnValueOnce(makeQb('getCount', 0)); // pendingCount

      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      managerMock.save.mockRejectedValueOnce(dbError);

      await expect(
        service.createIndividualSession('student-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates session, scheduledSession, and participation on success', async () => {
      setupHappyPath();

      const result = await service.createIndividualSession('student-1', dto);

      expect(managerMock.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        }),
      );
      expect(result.success).toBe(true);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('includes pending request count in message when slot already has pending requests', async () => {
      managerMock.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', null)) // no confirmed
        .mockReturnValueOnce(makeQb('getCount', 2)); // 2 other pending

      sessionRepository.findOne.mockResolvedValue(mockSession());

      const result = await service.createIndividualSession('student-1', dto);

      expect(result.pendingRequestsCount).toBe(2);
      expect(result.message).toContain('2');
    });
  });
});
