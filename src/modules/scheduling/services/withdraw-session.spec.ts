import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { Session } from '../entities/session.entity';
import { ScheduledSession } from '../entities/scheduled-session.entity';
import { SessionStatus } from '../enums/session-status.enum';

describe('SessionService.withdrawPendingRequest', () => {
  let service: SessionService;
  let sessionRepository: any;
  let queryRunner: any;
  let notificationsService: any;

  const makeSession = (status = SessionStatus.PENDING_TUTOR_CONFIRMATION) => ({
    idSession: 'session-1',
    idTutor: 'tutor-1',
    status,
    cancellationReason: undefined,
    cancelledAt: undefined,
    cancelledBy: undefined,
    subject: { name: 'Álgebra' },
    studentParticipateSessions: [
      {
        idStudent: 'student-1',
        student: { user: { name: 'Ana Pérez' } },
      },
    ],
  });

  beforeEach(() => {
    const manager = {
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    queryRunner = {
      manager,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    sessionRepository = { findOne: jest.fn() };
    notificationsService = {
      sendPendingSessionWithdrawal: jest.fn().mockResolvedValue(undefined),
    };

    service = new SessionService(
      sessionRepository,
      {} as any,
      {} as any,
      {} as any,
      { createQueryRunner: jest.fn(() => queryRunner) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      notificationsService,
    );
  });

  it('withdraws the pending request, frees its slot, and notifies the tutor', async () => {
    const session = makeSession();
    queryRunner.manager.findOne
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        idSession: 'session-1',
        idStudent: 'student-1',
      });
    sessionRepository.findOne.mockResolvedValue(session);

    const result = await service.withdrawPendingRequest(
      'student-1',
      'session-1',
      {
        reason: 'Ya no necesito la tutoría',
      },
    );

    expect(session.status).toBe(SessionStatus.WITHDRAWN_BY_STUDENT);
    expect(session.cancellationReason).toBe('Ya no necesito la tutoría');
    expect(session.cancelledBy).toBe('student-1');
    expect(queryRunner.manager.delete).toHaveBeenCalledWith(ScheduledSession, {
      idSession: 'session-1',
    });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(
      notificationsService.sendPendingSessionWithdrawal,
    ).toHaveBeenCalledWith(session, 'Ana Pérez');
    expect(result.success).toBe(true);
  });

  it('allows withdrawal without a reason', async () => {
    const session = makeSession();
    queryRunner.manager.findOne
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        idSession: 'session-1',
        idStudent: 'student-1',
      });
    sessionRepository.findOne.mockResolvedValue(session);

    await service.withdrawPendingRequest('student-1', 'session-1');

    expect(session.cancellationReason).toBeUndefined();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('returns not found when the session does not exist', async () => {
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(
      service.withdrawPendingRequest('student-1', 'missing-session'),
    ).rejects.toThrow(NotFoundException);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('forbids a student who is not a participant', async () => {
    queryRunner.manager.findOne
      .mockResolvedValueOnce(makeSession())
      .mockResolvedValueOnce(null);

    await expect(
      service.withdrawPendingRequest('other-student', 'session-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(queryRunner.manager.delete).not.toHaveBeenCalled();
  });

  it('rejects a session that is no longer pending', async () => {
    queryRunner.manager.findOne
      .mockResolvedValueOnce(makeSession(SessionStatus.SCHEDULED))
      .mockResolvedValueOnce({
        idSession: 'session-1',
        idStudent: 'student-1',
      });

    await expect(
      service.withdrawPendingRequest('student-1', 'session-1'),
    ).rejects.toThrow(BadRequestException);
    expect(queryRunner.manager.delete).not.toHaveBeenCalled();
  });

  it('does not fail the withdrawal if notification persistence fails', async () => {
    const session = makeSession();
    queryRunner.manager.findOne
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        idSession: 'session-1',
        idStudent: 'student-1',
      });
    sessionRepository.findOne.mockResolvedValue(session);
    notificationsService.sendPendingSessionWithdrawal.mockRejectedValue(
      new Error('notification storage unavailable'),
    );
    const originalConsoleError = console.error;
    console.error = jest.fn();

    try {
      await expect(
        service.withdrawPendingRequest('student-1', 'session-1'),
      ).resolves.toMatchObject({ success: true });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });
});
