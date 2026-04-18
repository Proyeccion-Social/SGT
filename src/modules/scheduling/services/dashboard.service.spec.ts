import { DashboardService } from './dashboard.service';
import { SessionStatus } from '../enums/session-status.enum';

describe('DashboardService', () => {
  let service: DashboardService;
  let sessionRepository: any;
  let participationRepository: any;
  let tutorService: any;

  const mockSessionCard = {
    idSession: 'session-1',
    title: 'Math',
    description: 'desc',
    scheduledDate: '2026-05-10',
    startTime: '09:00',
    endTime: '10:00',
    status: SessionStatus.SCHEDULED,
    type: 'individual',
    modality: 'VIRTUAL',
    tutor: { user: { name: 'Tutor One' }, urlImage: null },
    subject: { name: 'Mathematics' },
    studentParticipateSessions: [],
  };

  /** Builds a chainable QueryBuilder mock with a configurable terminal call. */
  const makeQb = (
    terminalFn: 'getMany' | 'getCount' | 'getRawOne',
    returnValue: any,
  ) => {
    const qb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getCount: jest.fn(),
      getRawOne: jest.fn(),
    };
    qb[terminalFn].mockResolvedValue(returnValue);
    return qb;
  };

  beforeEach(() => {
    sessionRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    participationRepository = {
      createQueryBuilder: jest.fn(),
    };
    tutorService = {
      getWeeklyHoursLimit: jest.fn(),
    };

    service = new DashboardService(
      sessionRepository,
      participationRepository,
      tutorService,
    );
  });

  // ─── getStudentDashboard ──────────────────────────────────────────────────────

  describe('getStudentDashboard', () => {
    it('returns weeklySessionsCount and upcoming sessions', async () => {
      // 1st QB: participation count for the week
      const weekCountQb = makeQb('getCount', 2);
      // 2nd QB: upcoming sessions
      const upcomingQb = makeQb('getMany', [mockSessionCard]);

      participationRepository.createQueryBuilder.mockReturnValueOnce(
        weekCountQb,
      );
      sessionRepository.createQueryBuilder.mockReturnValueOnce(upcomingQb);

      const result = await service.getStudentDashboard('student-1');

      expect(result.weeklySessionsCount).toBe(2);
      expect(result.upcomingSessions).toHaveLength(1);
    });

    it('falls back to completed sessions when no upcoming sessions exist', async () => {
      const weekCountQb = makeQb('getCount', 0);
      const emptyUpcomingQb = makeQb('getMany', []); // no upcoming
      const historyQb = makeQb('getMany', [mockSessionCard]); // history fallback

      participationRepository.createQueryBuilder.mockReturnValueOnce(
        weekCountQb,
      );
      sessionRepository.createQueryBuilder
        .mockReturnValueOnce(emptyUpcomingQb)
        .mockReturnValueOnce(historyQb);

      const result = await service.getStudentDashboard('student-1');

      expect(result.upcomingSessions).toHaveLength(1);
    });
  });

  // ─── getTutorDashboard ────────────────────────────────────────────────────────

  describe('getTutorDashboard', () => {
    it('returns weekly hours and upcoming sessions for tutor', async () => {
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);
      // calculateWeeklyHours uses sessionRepository.find
      sessionRepository.find.mockResolvedValue([
        { startTime: '09:00', endTime: '11:00' }, // 2h
      ]);
      // Upcoming sessions QB
      const upcomingQb = makeQb('getMany', [mockSessionCard]);
      sessionRepository.createQueryBuilder.mockReturnValueOnce(upcomingQb);
      // getTotalStudentsReached QB
      const studentsQb = makeQb('getRawOne', { count: '5' });
      participationRepository.createQueryBuilder.mockReturnValueOnce(
        studentsQb,
      );

      const result = await service.getTutorDashboard('tutor-1');

      expect(result.weeklyHoursLimit).toBe(10);
      expect(result.weeklyHoursUsed).toBe(2);
      expect(result.weeklyHoursRemaining).toBe(8);
      expect(result.upcomingSessions).toHaveLength(1);
      expect(result.totalStudentsReached).toBe(5);
    });

    it('calculates weekly hours from multiple sessions correctly', async () => {
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);
      sessionRepository.find.mockResolvedValue([
        { startTime: '09:00', endTime: '10:30' }, // 1.5h
        { startTime: '14:00', endTime: '16:00' }, // 2h
      ]);
      const upcomingQb = makeQb('getMany', []);
      const historyQb = makeQb('getMany', []);
      sessionRepository.createQueryBuilder
        .mockReturnValueOnce(upcomingQb)
        .mockReturnValueOnce(historyQb);
      const studentsQb = makeQb('getRawOne', { count: '0' });
      participationRepository.createQueryBuilder.mockReturnValueOnce(
        studentsQb,
      );

      const result = await service.getTutorDashboard('tutor-1');

      expect(result.weeklyHoursUsed).toBe(3.5);
      expect(result.weeklyHoursRemaining).toBe(6.5);
    });

    it('clamps weeklyHoursRemaining to 0 when hours exceed the limit', async () => {
      tutorService.getWeeklyHoursLimit.mockResolvedValue(2);
      sessionRepository.find.mockResolvedValue([
        { startTime: '09:00', endTime: '14:00' }, // 5h > limit of 2
      ]);
      const upcomingQb = makeQb('getMany', []);
      const historyQb = makeQb('getMany', []);
      sessionRepository.createQueryBuilder
        .mockReturnValueOnce(upcomingQb)
        .mockReturnValueOnce(historyQb);
      const studentsQb = makeQb('getRawOne', { count: '0' });
      participationRepository.createQueryBuilder.mockReturnValueOnce(
        studentsQb,
      );

      const result = await service.getTutorDashboard('tutor-1');

      expect(result.weeklyHoursRemaining).toBe(0);
    });

    it('returns 0 totalStudentsReached when getRawOne returns null', async () => {
      tutorService.getWeeklyHoursLimit.mockResolvedValue(10);
      sessionRepository.find.mockResolvedValue([]);
      const upcomingQb = makeQb('getMany', []);
      const historyQb = makeQb('getMany', []);
      sessionRepository.createQueryBuilder
        .mockReturnValueOnce(upcomingQb)
        .mockReturnValueOnce(historyQb);
      const studentsQb = makeQb('getRawOne', null);
      participationRepository.createQueryBuilder.mockReturnValueOnce(
        studentsQb,
      );

      const result = await service.getTutorDashboard('tutor-1');

      expect(result.totalStudentsReached).toBe(0);
    });
  });
});
