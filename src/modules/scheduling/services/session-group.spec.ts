import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionStatus } from '../enums/session-status.enum';
import { SessionType } from '../enums/session-type.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const makeQb = (terminal: string, value: any) => {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(null),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  qb[terminal].mockResolvedValue(value);
  return qb;
};

const FUTURE_DATE = '2030-01-07'; // lunes

const makeGroupSession = (overrides: Partial<any> = {}): any => ({
  idSession: 'group-session-1',
  idTutor: 'tutor-1',
  idSubject: 'subject-1',
  scheduledDate: FUTURE_DATE,
  startTime: '09:00',
  endTime: '10:00',
  title: 'Grupo de Cálculo',
  description: 'Sesión grupal de repaso',
  type: SessionType.GROUP,
  modality: 'VIRTUAL',
  status: SessionStatus.SCHEDULED,
  tutorConfirmed: true,
  maxParticipants: 30,
  studentParticipateSessions: [
    {
      idStudent: 'student-1',
      status: ParticipationStatus.CONFIRMED,
      joinedAt: new Date('2030-01-01T10:00:00Z'),
      student: { idUser: 'student-1', user: { name: 'Ana' } },
    },
  ],
  tutor: { idUser: 'tutor-1', user: { name: 'Carlos' }, urlImage: null },
  subject: { idSubject: 'subject-1', name: 'Cálculo' },
  createdAt: new Date(),
  cancelledAt: null,
  cancellationReason: null,
  ...overrides,
});

const makeCreateGroupDto = (overrides: Partial<any> = {}): any => ({
  tutorId: 'tutor-1',
  subjectId: 'subject-1',
  availabilityId: 10,
  scheduledDate: FUTURE_DATE,
  durationHours: 1,
  modality: 'VIRTUAL',
  title: 'Grupo de Cálculo',
  description: 'Sesión grupal de repaso',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionService — Sesiones Grupales', () => {
  let service: SessionService;

  let sessionRepo: any;
  let scheduledSessionRepo: any;
  let studentParticipateRepo: any;
  let modificationRequestRepo: any;
  let dataSource: any;
  let qrManager: any;
  let queryRunner: any;

  let validationService: any;
  let availabilityService: any;
  let tutorService: any;
  let userService: any;
  let subjectsService: any;
  let notificationsService: any;

  beforeEach(() => {
    qrManager = {
      create: jest.fn((_, data) => ({ ...data })),
      save: jest.fn(async (e) => ({ ...e, idSession: 'group-session-1' })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: qrManager,
    };

    sessionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (e) => e),
      createQueryBuilder: jest.fn(),
    };
    scheduledSessionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    studentParticipateRepo = {
      createQueryBuilder: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    modificationRequestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (e) => ({ ...e, idRequest: 'req-1' })),
    };
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

    validationService = {
      validateStudentNotTutor: jest.fn(),
      validateModality: jest.fn().mockResolvedValue(undefined),
      validateScheduledDateMatchesSlotDay: jest
        .fn()
        .mockResolvedValue(undefined),
      validateMinimumBookingAdvance: jest.fn(),
      validateModificationAdvanceTime: jest.fn(), // usado por proposeModification
      validateAvailabilitySlotWithDuration: jest
        .fn()
        .mockResolvedValue(undefined),
      validateNoTimeConflict: jest.fn().mockResolvedValue(undefined),
      validateStudentNoTimeConflict: jest.fn().mockResolvedValue(undefined),
      validateWeeklyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateDailyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateCancellationTime: jest.fn().mockReturnValue(true),
      calculateEndTime: jest.fn().mockReturnValue('10:00'),
      calculateConfirmationExpiry: jest.fn().mockReturnValue(new Date()),
    };

    availabilityService = {
      getAvailabilityById: jest.fn().mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0,
        startTime: '09:00',
      }),
    };
    tutorService = {
      validateTutorActive: jest.fn().mockResolvedValue(undefined),
    };
    userService = { isAdmin: jest.fn().mockResolvedValue(false) };
    subjectsService = {};
    notificationsService = {
      sendTutorConfirmationRequest: jest.fn().mockResolvedValue(undefined),
      sendStudentSessionRequestAck: jest.fn().mockResolvedValue(undefined),
      sendSessionConfirmationStudent: jest.fn().mockResolvedValue(undefined),
      sendSessionConfirmationTutor: jest.fn().mockResolvedValue(undefined),
      sendSessionCancellation: jest.fn().mockResolvedValue(undefined),
      sendGroupSessionParticipantLeft: jest.fn().mockResolvedValue(undefined),
      sendSessionRejection: jest.fn().mockResolvedValue(undefined),
      sendModificationRequest: jest.fn().mockResolvedValue(undefined),
    };

    service = new SessionService(
      sessionRepo,
      scheduledSessionRepo,
      studentParticipateRepo,
      modificationRequestRepo,
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
  // 1. CREACIÓN DE SESIÓN GRUPAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createGroupSession', () => {
    const setupHappyPath = () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', [])) // daySessions (daily hours check)
        .mockReturnValueOnce(makeQb('getOne', null)); // confirmedInSlot
      sessionRepo.findOne.mockResolvedValue(makeGroupSession());
    };

    it('crea la sesión con type=GROUP y estado PENDING_TUTOR_CONFIRMATION', async () => {
      setupHappyPath();

      const result = await service.createGroupSession(
        'student-1',
        makeCreateGroupDto(),
      );

      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: SessionType.GROUP,
          status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        }),
      );
      expect(result.success).toBe(true);
    });

    it('usa maxParticipants=30 por defecto cuando no se especifica', async () => {
      setupHappyPath();

      await service.createGroupSession('student-1', makeCreateGroupDto());

      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxParticipants: 30 }),
      );
    });

    it('respeta maxParticipants cuando se especifica explícitamente', async () => {
      setupHappyPath();

      await service.createGroupSession(
        'student-1',
        makeCreateGroupDto({ maxParticipants: 5 }),
      );

      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxParticipants: 5 }),
      );
    });

    it('valida que el estudiante creador no tenga conflicto de horario consigo mismo', async () => {
      setupHappyPath();

      await service.createGroupSession('student-1', makeCreateGroupDto());

      expect(
        validationService.validateStudentNoTimeConflict,
      ).toHaveBeenCalledWith('student-1', FUTURE_DATE, '09:00', 1);
    });

    it('crea la primera participación (creador) con joinedAt', async () => {
      setupHappyPath();

      await service.createGroupSession('student-1', makeCreateGroupDto());

      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idStudent: 'student-1',
          status: ParticipationStatus.CONFIRMED,
          joinedAt: expect.any(Date),
        }),
      );
    });

    it('reutiliza todas las validaciones de negocio del flujo individual', async () => {
      setupHappyPath();

      await service.createGroupSession('student-1', makeCreateGroupDto());

      expect(validationService.validateStudentNotTutor).toHaveBeenCalled();
      expect(tutorService.validateTutorActive).toHaveBeenCalled();
      expect(validationService.validateModality).toHaveBeenCalled();
      expect(
        validationService.validateScheduledDateMatchesSlotDay,
      ).toHaveBeenCalled();
      expect(
        validationService.validateMinimumBookingAdvance,
      ).toHaveBeenCalled();
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalled();
      expect(validationService.validateNoTimeConflict).toHaveBeenCalled();
      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalled();
    });

    it('rechaza si el slot ya está confirmado para otra sesión (lock pesimista)', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', { idSession: 'other-session' }));

      await expect(
        service.createGroupSession('student-1', makeCreateGroupDto()),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rechaza si excede el límite diario del tutor', async () => {
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getMany', [
          { startTime: '09:00', endTime: '13:00' }, // 4h ya usadas
        ]),
      );

      await expect(
        service.createGroupSession(
          'student-1',
          makeCreateGroupDto({ durationHours: 1 }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. UNIRSE A SESIÓN GRUPAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('joinGroupSession', () => {
    it('permite unirse exitosamente a una sesión grupal SCHEDULED con cupo disponible', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null); // no existingParticipation
      qrManager.count.mockResolvedValueOnce(1); // 1 participante actual
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.joinGroupSession(
        'student-2',
        'group-session-1',
      );

      expect(result.success).toBe(true);
      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idStudent: 'student-2',
          idSession: 'group-session-1',
          status: ParticipationStatus.CONFIRMED,
          joinedAt: expect.any(Date),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rechaza si la sesión no existe', async () => {
      qrManager.createQueryBuilder.mockReturnValueOnce(makeQb('getOne', null));

      await expect(
        service.joinGroupSession('student-2', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si la sesión no es de tipo GROUP', async () => {
      const individualSession = makeGroupSession({
        type: SessionType.INDIVIDUAL,
      });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', individualSession),
      );

      await expect(
        service.joinGroupSession('student-2', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la sesión aún no está confirmada (PENDING_TUTOR_CONFIRMATION)', async () => {
      const pendingSession = makeGroupSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', pendingSession),
      );

      await expect(
        service.joinGroupSession('student-2', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la sesión ya fue cancelada', async () => {
      const cancelledSession = makeGroupSession({
        status: SessionStatus.CANCELLED_BY_STUDENT,
      });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', cancelledSession),
      );

      await expect(
        service.joinGroupSession('student-2', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el tutor intenta unirse a su propia sesión', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );

      await expect(
        service.joinGroupSession('tutor-1', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el estudiante ya es participante', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce({ idStudent: 'student-1' }); // ya participa

      await expect(
        service.joinGroupSession('student-1', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la sesión alcanzó su cupo máximo', async () => {
      const fullSession = makeGroupSession({ maxParticipants: 2 });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', fullSession),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(2); // ya al límite

      await expect(
        service.joinGroupSession('student-3', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite unirse cuando faltan cupos por llenar (justo antes del límite)', async () => {
      const session = makeGroupSession({ maxParticipants: 3 });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(2); // 2 de 3, cabe uno más
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.joinGroupSession(
        'student-3',
        'group-session-1',
      );

      expect(result.success).toBe(true);
    });

    it('usa cupo por defecto de 30 si maxParticipants es null', async () => {
      const session = makeGroupSession({ maxParticipants: null });
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(29);
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.joinGroupSession(
        'student-30',
        'group-session-1',
      );

      expect(result.success).toBe(true);
    });

    it('valida que el estudiante no tenga conflicto de horario con otra sesión propia', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(1);
      sessionRepo.findOne.mockResolvedValue(session);

      await service.joinGroupSession('student-2', 'group-session-1');

      expect(
        validationService.validateStudentNoTimeConflict,
      ).toHaveBeenCalledWith(
        'student-2',
        session.scheduledDate,
        session.startTime,
        1, // duración calculada de 09:00 a 10:00
      );
    });

    it('rechaza si el estudiante tiene conflicto de horario con otra sesión', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(1);
      validationService.validateStudentNoTimeConflict.mockRejectedValue(
        new BadRequestException('Conflicto de horario'),
      );

      await expect(
        service.joinGroupSession('student-2', 'group-session-1'),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('notifica al nuevo estudiante y al tutor tras unirse', async () => {
      const session = makeGroupSession();
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', session),
      );
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(1);
      sessionRepo.findOne.mockResolvedValue(session);

      await service.joinGroupSession('student-2', 'group-session-1');

      expect(
        notificationsService.sendSessionConfirmationStudent,
      ).toHaveBeenCalledWith(expect.anything(), 'student-2');
      expect(
        notificationsService.sendSessionConfirmationTutor,
      ).toHaveBeenCalledWith(expect.anything(), 'tutor-1');
    });

    it('adquiere lock pesimista sobre la sesión para serializar uniones concurrentes', async () => {
      const session = makeGroupSession();
      const qb = makeQb('getOne', session);
      qrManager.createQueryBuilder.mockReturnValueOnce(qb);
      qrManager.findOne.mockResolvedValueOnce(null);
      qrManager.count.mockResolvedValueOnce(1);
      sessionRepo.findOne.mockResolvedValue(session);

      await service.joinGroupSession('student-2', 'group-session-1');

      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CANCELACIÓN / ABANDONO DE SESIÓN GRUPAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelSession — sesiones grupales', () => {
    const sessionWithTwoParticipants = () =>
      makeGroupSession({
        studentParticipateSessions: [
          {
            idStudent: 'student-1',
            status: ParticipationStatus.CONFIRMED,
            joinedAt: new Date(),
            student: { idUser: 'student-1', user: { name: 'Ana' } },
          },
          {
            idStudent: 'student-2',
            status: ParticipationStatus.CONFIRMED,
            joinedAt: new Date(),
            student: { idUser: 'student-2', user: { name: 'Beto' } },
          },
        ],
      });

    it('un estudiante que abandona una sesión con más participantes NO cancela la sesión completa', async () => {
      const session = sessionWithTwoParticipants();
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.cancelSession(
        'student-1',
        'group-session-1',
        {
          reason: 'no puedo asistir',
        },
      );

      expect(result.message).toContain('Abandonaste');
      // No debe tocar la Session ni el ScheduledSession
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(scheduledSessionRepo.delete).not.toHaveBeenCalled();
      // Solo elimina su propia participación
      expect(studentParticipateRepo.delete).toHaveBeenCalledWith({
        idSession: 'group-session-1',
        idStudent: 'student-1',
      });
    });

    it('notifica el abandono al tutor y a los demás participantes', async () => {
      const session = sessionWithTwoParticipants();
      sessionRepo.findOne.mockResolvedValue(session);

      await service.cancelSession('student-1', 'group-session-1', {
        reason: 'x',
      });

      expect(
        notificationsService.sendGroupSessionParticipantLeft,
      ).toHaveBeenCalledWith(session, 'student-1');
      expect(
        notificationsService.sendSessionCancellation,
      ).not.toHaveBeenCalled();
    });

    it('si es el último participante restante, cancela la sesión completa y libera el slot', async () => {
      const session = makeGroupSession(); // solo 1 participante
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.cancelSession(
        'student-1',
        'group-session-1',
        {
          reason: 'x',
        },
      );

      expect(session.status).toBe(SessionStatus.CANCELLED_BY_STUDENT);
      expect(sessionRepo.save).toHaveBeenCalled();
      expect(scheduledSessionRepo.delete).toHaveBeenCalledWith({
        idSession: 'group-session-1',
      });
      expect(notificationsService.sendSessionCancellation).toHaveBeenCalled();
      expect(result.message).toBe('Sesión cancelada exitosamente');
    });

    it('si el TUTOR cancela una sesión grupal con múltiples participantes, cancela para todos', async () => {
      const session = sessionWithTwoParticipants();
      sessionRepo.findOne.mockResolvedValue(session);

      const result = await service.cancelSession('tutor-1', 'group-session-1', {
        reason: 'imprevisto',
      });

      expect(session.status).toBe(SessionStatus.CANCELLED_BY_TUTOR);
      expect(scheduledSessionRepo.delete).toHaveBeenCalledWith({
        idSession: 'group-session-1',
      });
      expect(notificationsService.sendSessionCancellation).toHaveBeenCalled();
      expect(studentParticipateRepo.delete).not.toHaveBeenCalled();
      expect(result.message).toBe('Sesión cancelada exitosamente');
    });

    it('un ADMIN que cancela una sesión grupal siempre cancela para todos (no abandona)', async () => {
      const session = sessionWithTwoParticipants();
      sessionRepo.findOne.mockResolvedValue(session);
      userService.isAdmin.mockResolvedValue(true);

      const result = await service.cancelSession('admin-1', 'group-session-1', {
        reason: 'política',
      });

      expect(session.status).toBe(SessionStatus.CANCELLED_BY_ADMIN);
      expect(scheduledSessionRepo.delete).toHaveBeenCalled();
      expect(result.message).toBe('Sesión cancelada exitosamente');
    });

    it('aplica la regla de 24h también al abandono parcial de sesión grupal', async () => {
      const session = sessionWithTwoParticipants();
      sessionRepo.findOne.mockResolvedValue(session);
      validationService.validateCancellationTime.mockReturnValue(false); // < 24h

      await expect(
        service.cancelSession('student-1', 'group-session-1', { reason: 'x' }),
      ).rejects.toThrow(BadRequestException);

      expect(studentParticipateRepo.delete).not.toHaveBeenCalled();
    });

    it('las sesiones INDIVIDUAL nunca entran en la rama de abandono parcial', async () => {
      const individualSession = makeGroupSession({
        type: SessionType.INDIVIDUAL,
        studentParticipateSessions: [
          {
            idStudent: 'student-1',
            status: ParticipationStatus.CONFIRMED,
            student: { idUser: 'student-1', user: { name: 'Ana' } },
          },
        ],
      });
      sessionRepo.findOne.mockResolvedValue(individualSession);

      const result = await service.cancelSession(
        'student-1',
        'group-session-1',
        {
          reason: 'x',
        },
      );

      expect(individualSession.status).toBe(SessionStatus.CANCELLED_BY_STUDENT);
      expect(scheduledSessionRepo.delete).toHaveBeenCalled();
      expect(result.message).toBe('Sesión cancelada exitosamente');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. BLOQUEO DE PROPUESTAS DE MODIFICACIÓN EN SESIONES GRUPALES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('proposeModification — bloqueo para sesiones grupales', () => {
    it('rechaza cualquier propuesta de modificación sobre una sesión GRUPAL', async () => {
      const groupSession = makeGroupSession({
        studentParticipateSessions: [{ idStudent: 'student-1' }],
        subject: { idSubject: 'subject-1', name: 'Cálculo' },
      });
      sessionRepo.findOne.mockResolvedValue(groupSession);

      await expect(
        service.proposeModification('student-1', 'group-session-1', {
          newScheduledDate: '2030-01-14',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(modificationRequestRepo.save).not.toHaveBeenCalled();
    });

    it('el tutor tampoco puede proponer modificaciones sobre sesiones grupales', async () => {
      const groupSession = makeGroupSession({
        studentParticipateSessions: [{ idStudent: 'student-1' }],
        subject: { idSubject: 'subject-1', name: 'Cálculo' },
      });
      sessionRepo.findOne.mockResolvedValue(groupSession);

      await expect(
        service.proposeModification('tutor-1', 'group-session-1', {
          newModality: 'PRES',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('las sesiones INDIVIDUAL siguen permitiendo propuestas de modificación normalmente', async () => {
      const individualSession = makeGroupSession({
        type: SessionType.INDIVIDUAL,
        studentParticipateSessions: [{ idStudent: 'student-1' }],
        subject: { idSubject: 'subject-1', name: 'Cálculo' },
      });
      sessionRepo.findOne.mockResolvedValue(individualSession);
      scheduledSessionRepo.findOne.mockResolvedValue({
        idSession: 'group-session-1',
        idAvailability: 10,
      });
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      const result = await service.proposeModification(
        'student-1',
        'group-session-1',
        { newScheduledDate: '2030-01-14' },
      );

      expect(result.success).toBe(true);
    });
  });
});
