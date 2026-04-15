import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';
import { ParticipationStatus } from '../../scheduling/enums/participation-status.enum';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let sessionRepository: any;
  let studentParticipateSessionRepository: any;
  let notificationsService: any;

  const PAST_DATE = '2020-01-01';
  const FUTURE_DATE = '2030-12-31';

  const mockSession = {
    idSession: 'session-1',
    idTutor: 'tutor-1',
    status: SessionStatus.SCHEDULED,
    tutorConfirmed: true,
    scheduledDate: PAST_DATE,
    startTime: '09:00',
    endTime: '10:00',
    title: 'Math Tutoring',
  };

  const mockParticipation = {
    idSession: 'session-1',
    idStudent: 'student-1',
    status: ParticipationStatus.PENDING,
    arrivalTime: null,
    student: { user: { name: 'Student One' } },
  };

  beforeEach(() => {
    sessionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    studentParticipateSessionRepository = {
      find: jest.fn(),
      save: jest.fn(),
    };
    notificationsService = {
      sendSessionAbsentNotification: jest.fn().mockResolvedValue(undefined),
      sendEvaluationPendingReminder: jest.fn().mockResolvedValue(undefined),
    };

    service = new AttendanceService(
      sessionRepository,
      studentParticipateSessionRepository,
      notificationsService,
    );
  });

  // ─── registerStudentAttendance ────────────────────────────────────────────────

  describe('registerStudentAttendance', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when session belongs to another tutor', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.registerStudentAttendance('session-1', 'other-tutor', {
          attendances: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when session status is not SCHEDULED', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when session is not tutor-confirmed', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        tutorConfirmed: false,
      });

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when session date is in the future', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        scheduledDate: FUTURE_DATE,
      });

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when duplicate studentIds are present', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [
            { studentId: 'student-1', status: ParticipationStatus.ATTENDED },
            { studentId: 'student-1', status: ParticipationStatus.ATTENDED },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when LATE status is provided without arrivalTime', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [
            {
              studentId: 'student-1',
              status: ParticipationStatus.LATE,
              arrivalTime: null,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when ABSENT status is provided with an arrivalTime', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [
            {
              studentId: 'student-1',
              status: ParticipationStatus.ABSENT,
              arrivalTime: '2020-01-01T09:05:00Z',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when a studentId is not among session participants', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      studentParticipateSessionRepository.find.mockResolvedValue([
        mockParticipation,
      ]);

      await expect(
        service.registerStudentAttendance('session-1', 'tutor-1', {
          attendances: [
            { studentId: 'student-999', status: ParticipationStatus.ATTENDED },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('saves attendance and returns success result', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      studentParticipateSessionRepository.find.mockResolvedValue([
        mockParticipation,
      ]);
      studentParticipateSessionRepository.save.mockResolvedValue([]);

      const result = await service.registerStudentAttendance(
        'session-1',
        'tutor-1',
        {
          attendances: [
            { studentId: 'student-1', status: ParticipationStatus.ATTENDED },
          ],
        },
      );

      expect(result.message).toContain('exitosamente');
      expect(result.sessionId).toBe('session-1');
      expect(studentParticipateSessionRepository.save).toHaveBeenCalled();
    });
  });

  // ─── registerCompletedSession ─────────────────────────────────────────────────

  describe('registerCompletedSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.registerCompletedSession('session-1', 'tutor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when session belongs to another tutor', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.registerCompletedSession('session-1', 'other-tutor'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when session is already COMPLETED', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.registerCompletedSession('session-1', 'tutor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when session is not tutor-confirmed', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        tutorConfirmed: false,
      });

      await expect(
        service.registerCompletedSession('session-1', 'tutor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when session date is in the future', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        scheduledDate: FUTURE_DATE,
      });

      await expect(
        service.registerCompletedSession('session-1', 'tutor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when attendance has not been recorded', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      // PENDING = attendance not recorded
      studentParticipateSessionRepository.find.mockResolvedValue([
        { ...mockParticipation, status: ParticipationStatus.PENDING },
      ]);

      await expect(
        service.registerCompletedSession('session-1', 'tutor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('marks session as COMPLETED and returns success', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      studentParticipateSessionRepository.find.mockResolvedValue([
        { ...mockParticipation, status: ParticipationStatus.ATTENDED },
      ]);
      sessionRepository.save.mockResolvedValue({});

      const result = await service.registerCompletedSession(
        'session-1',
        'tutor-1',
      );

      expect(result.status).toBe(SessionStatus.COMPLETED);
      expect(result.message).toContain('completada exitosamente');
      expect(sessionRepository.save).toHaveBeenCalled();
    });
  });
});
