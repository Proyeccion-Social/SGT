import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationService } from './evaluation.service';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';
import { UserRole } from '../../users/entities/user.entity';
import { QuestionAspect } from '../entities/question.entity';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let questionRepository: any;
  let answerRepository: any;
  let sessionRepository: any;
  let participationRepository: any;
  let userRepository: any;

  const PAST_DATE = '2020-01-01';
  const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]; // 2 days ago → within 7-day window

  const mockSession = {
    idSession: 'session-1',
    idTutor: 'tutor-1',
    status: SessionStatus.COMPLETED,
    scheduledDate: RECENT_DATE,
    startTime: '09:00',
    endTime: '10:00',
  };

  const mockParticipation = {
    idSession: 'session-1',
    idStudent: 'student-1',
    comment: '',
  };

  const mockQuestions = [
    { idQuestion: 'q-1', aspect: QuestionAspect.CLARITY, isActive: true, questionnaireVersion: '1.0' },
    { idQuestion: 'q-2', aspect: QuestionAspect.PATIENCE, isActive: true, questionnaireVersion: '1.0' },
    { idQuestion: 'q-3', aspect: QuestionAspect.PUNCTUALITY, isActive: true, questionnaireVersion: '1.0' },
    { idQuestion: 'q-4', aspect: QuestionAspect.KNOWLEDGE, isActive: true, questionnaireVersion: '1.0' },
  ];

  const mockDto = {
    ratings: { clarity: 5, patience: 4, punctuality: 5, knowledge: 4 },
    overallRating: 4.5,
    comments: 'Great session',
  };

  const createQueryBuilderMock = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  });

  beforeEach(() => {
    questionRepository = { find: jest.fn() };
    answerRepository = {
      exists: jest.fn(),
      count: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    sessionRepository = { findOne: jest.fn() };
    participationRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    userRepository = {};

    service = new EvaluationService(
      questionRepository,
      answerRepository,
      sessionRepository,
      participationRepository,
      userRepository,
    );
  });

  // ─── getEvaluationQuestionnaire ───────────────────────────────────────────────

  describe('getEvaluationQuestionnaire', () => {
    it('returns questionnaire with questions and comments config', async () => {
      questionRepository.find.mockResolvedValue(mockQuestions);

      const result = await service.getEvaluationQuestionnaire();

      expect(result.questionnaire.version).toBe('1.0');
      expect(result.questionnaire.questions).toHaveLength(4);
      expect(result.questionnaire.comments.enabled).toBe(true);
    });
  });

  // ─── sendSessionEvaluation ────────────────────────────────────────────────────

  describe('sendSessionEvaluation', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.sendSessionEvaluation('session-1', 'student-1', mockDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when student did not participate in the session', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      participationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.sendSessionEvaluation('session-1', 'student-1', mockDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when session is not COMPLETED', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.SCHEDULED,
      });
      participationRepository.findOne.mockResolvedValue(mockParticipation);

      await expect(
        service.sendSessionEvaluation('session-1', 'student-1', mockDto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when student has already evaluated the session', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      participationRepository.findOne.mockResolvedValue(mockParticipation);
      answerRepository.exists.mockResolvedValue(true);

      await expect(
        service.sendSessionEvaluation('session-1', 'student-1', mockDto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when evaluation deadline (7 days) has passed', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        scheduledDate: PAST_DATE, // clearly more than 7 days ago
      });
      participationRepository.findOne.mockResolvedValue(mockParticipation);
      answerRepository.exists.mockResolvedValue(false);

      await expect(
        service.sendSessionEvaluation('session-1', 'student-1', mockDto),
      ).rejects.toThrow(ConflictException);
    });

    it('saves answers and returns evaluation result on success', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      participationRepository.findOne.mockResolvedValue(mockParticipation);
      answerRepository.exists.mockResolvedValue(false);
      questionRepository.find.mockResolvedValue(mockQuestions);
      answerRepository.save.mockResolvedValue([]);
      participationRepository.save.mockResolvedValue(mockParticipation);

      const result = await service.sendSessionEvaluation('session-1', 'student-1', mockDto);

      expect(result.message).toContain('exitosamente');
      expect(result.sessionId).toBe('session-1');
      expect(result.ratings).toEqual(mockDto.ratings);
      expect(answerRepository.save).toHaveBeenCalled();
    });

    it('computes overallRating as average when not explicitly provided', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      participationRepository.findOne.mockResolvedValue(mockParticipation);
      answerRepository.exists.mockResolvedValue(false);
      questionRepository.find.mockResolvedValue(mockQuestions);
      answerRepository.save.mockResolvedValue([]);
      participationRepository.save.mockResolvedValue(mockParticipation);

      const dtoNoOverall = { ...mockDto, overallRating: undefined };
      const result = await service.sendSessionEvaluation('session-1', 'student-1', dtoNoOverall);

      // (5 + 4 + 5 + 4) / 4 = 4.5
      expect(result.overallRating).toBe(4.5);
    });
  });

  // ─── getSessionEvaluation ─────────────────────────────────────────────────────

  describe('getSessionEvaluation', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getSessionEvaluation('session-1', 'user-1', UserRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when session is not COMPLETED', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.SCHEDULED,
      });

      await expect(
        service.getSessionEvaluation('session-1', 'user-1', UserRole.ADMIN),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when student has no evaluation for the session', async () => {
      sessionRepository.findOne.mockResolvedValue(mockSession);
      answerRepository.count.mockResolvedValue(0);

      await expect(
        service.getSessionEvaluation('session-1', 'student-1', UserRole.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when tutor does not own the session', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        idTutor: 'other-tutor',
      });

      await expect(
        service.getSessionEvaluation('session-1', 'tutor-1', UserRole.TUTOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when no answers exist for the session', async () => {
      sessionRepository.findOne.mockResolvedValue({
        ...mockSession,
        idTutor: 'tutor-1',
      });
      const qb = createQueryBuilderMock();
      qb.getMany.mockResolvedValue([]);
      answerRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.getSessionEvaluation('session-1', 'tutor-1', UserRole.TUTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
