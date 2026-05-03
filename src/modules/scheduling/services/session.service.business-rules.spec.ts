import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionStatus } from '../enums/session-status.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';
import { ModificationStatus } from '../enums/modification-status.enum';
import { SessionType } from '../enums/session-type.enum';
import { Modality } from '../../availability/enums/modality.enum';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un QueryBuilder chainable con el terminal configurado */
const makeQb = (terminal: string, value: any) => {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb[terminal].mockResolvedValue(value);
  return qb;
};

/** Sesión base reutilizable */
const makeSession = (overrides: Partial<any> = {}): any => ({
  idSession: 'session-1',
  idTutor: 'tutor-1',
  idSubject: 'subject-1',
  scheduledDate: '2030-01-06', // lunes
  startTime: '09:00',
  endTime: '10:00',
  title: 'Cálculo I',
  description: 'Sesión de prueba',
  type: SessionType.INDIVIDUAL,
  modality: 'VIRT',
  location: null,
  virtualLink: null,
  status: SessionStatus.SCHEDULED,
  tutorConfirmed: true,
  tutorConfirmedAt: new Date(),
  cancellationReason: null,
  cancelledAt: null,
  cancelledWithin24h: false,
  cancelledBy: null,
  rejectionReason: null,
  rejectedAt: null,
  createdAt: new Date(),
  confirmationExpiresAt: new Date('2030-01-05T23:59:59Z'),
  tutor: { idUser: 'tutor-1', user: { name: 'Carlos' }, urlImage: null },
  subject: { idSubject: 'subject-1', name: 'Cálculo' },
  studentParticipateSessions: [
    {
      idStudent: 'student-1',
      status: ParticipationStatus.CONFIRMED,
      student: { idUser: 'student-1', user: { name: 'Ana' } },
    },
  ],
  scheduledSession: null,
  modificationRequests: [],
  ...overrides,
});

/** DTO de creación base */
const makeCreateDto = (overrides: Partial<any> = {}): any => ({
  tutorId: 'tutor-1',
  subjectId: 'subject-1',
  availabilityId: 10,
  scheduledDate: '2030-01-06', // lunes — coincide con slot de lunes
  durationHours: 1,
  modality: 'VIRT',
  title: 'Cálculo I',
  description: 'Repaso',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

describe('SessionService — Business Rules (Integration)', () => {
  let service: SessionService;

  // Repositories
  let sessionRepo: any;
  let scheduledSessionRepo: any;
  let studentParticipateRepo: any;
  let modificationRequestRepo: any;
  let dataSource: any;
  let qrManager: any;
  let queryRunner: any;

  // Services
  let validationService: any;
  let availabilityService: any;
  let tutorService: any;
  let userService: any;
  let subjectsService: any;
  let notificationsService: any;

  beforeEach(() => {
    qrManager = {
      create: jest.fn((_, data) => ({ ...data })),
      save: jest.fn(async (e) => ({ ...e, idSession: 'session-1' })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      remove: jest.fn().mockResolvedValue(undefined),
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
    };
    modificationRequestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (e) => ({ ...e, idRequest: 'req-1' })),
    };
    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };

    // Por defecto todas las validaciones pasan
    validationService = {
      // Síncrono en la implementación real — se usa mockReturnValue (no mockResolvedValue)
      validateStudentNotTutor: jest.fn().mockReturnValue(undefined),

      validateModality: jest.fn().mockResolvedValue(undefined),
      validateScheduledDateMatchesSlotDay: jest
        .fn()
        .mockResolvedValue(undefined),
      validateAvailabilitySlotWithDuration: jest
        .fn()
        .mockResolvedValue(undefined),
      validateAvailabilitySlot: jest.fn().mockResolvedValue(undefined),
      validateNoTimeConflict: jest.fn().mockResolvedValue(undefined),
      validateWeeklyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateDailyHoursLimit: jest.fn().mockResolvedValue(undefined),
      validateCancellationTime: jest.fn().mockReturnValue(true),

      // NUEVOS — añadidos con la implementación de expiración y antelación mínima
      validateMinimumBookingAdvance: jest.fn().mockReturnValue(undefined),
      validateModificationAdvanceTime: jest.fn().mockReturnValue(undefined),

      calculateEndTime: jest.fn((start: string, hours: number) => {
        const [h, m] = start.split(':').map(Number);
        const totalMin = h * 60 + m + hours * 60;
        const rh = Math.floor(totalMin / 60);
        const rm = totalMin % 60;
        return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
      }),

      // NUEVO — helper para precalcular confirmationExpiresAt
      calculateConfirmationExpiry: jest
        .fn()
        .mockReturnValue(new Date('2030-01-05T23:59:59Z')),
    };

    availabilityService = {
      getAvailabilityById: jest.fn().mockResolvedValue({
        idAvailability: 10,
        dayOfWeek: 0, // lunes
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
      sendSessionRejection: jest.fn().mockResolvedValue(undefined),
      sendSessionCancellation: jest.fn().mockResolvedValue(undefined),
      sendModificationRequest: jest.fn().mockResolvedValue(undefined),
      sendModificationResponse: jest.fn().mockResolvedValue(undefined),
      sendSessionDetailsUpdate: jest.fn().mockResolvedValue(undefined),
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
  // 1. REGLAS DE DISPONIBILIDAD Y DURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  describe('1 — Disponibilidad y duración de slots', () => {
    it('rechaza agendamiento cuando la duración supera los slots contiguos disponibles del tutor', async () => {
      validationService.validateAvailabilitySlotWithDuration.mockRejectedValue(
        new ConflictException(
          'No hay suficientes franjas contiguas para cubrir 1h desde las 09:30',
        ),
      );

      await expect(
        service.createIndividualSession(
          'student-1',
          makeCreateDto({ availabilityId: 10, durationHours: 1 }),
        ),
      ).rejects.toThrow(ConflictException);

      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalledWith('tutor-1', 10, '2030-01-06', 1);
    });

    it('permite agendamiento cuando la duración coincide exactamente con el único slot disponible', async () => {
      // dailySessions → getMany vacío, confirmedInSlot → null, pendingCount → 0
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));

      sessionRepo.findOne.mockResolvedValue(makeSession());

      const result = await service.createIndividualSession(
        'student-1',
        makeCreateDto({ durationHours: 0.5 }),
      );

      expect(result.success).toBe(true);
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalledWith('tutor-1', 10, '2030-01-06', 0.5);
      // Verificar que se precalculó y persistió confirmationExpiresAt
      expect(
        validationService.calculateConfirmationExpiry,
      ).toHaveBeenCalledWith('2030-01-06', '09:00');
      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ confirmationExpiresAt: expect.any(Date) }),
      );
    });

    it('permite reservar el mismo slot de disponibilidad en fechas distintas sin conflicto', async () => {
      // Primera llamada — semana 1
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ scheduledDate: '2030-01-06' }),
      );

      const result1 = await service.createIndividualSession(
        'student-1',
        makeCreateDto({ scheduledDate: '2030-01-06' }),
      );
      expect(result1.success).toBe(true);

      // Segunda llamada — semana siguiente, mismo slot
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ scheduledDate: '2030-01-13' }),
      );

      const result2 = await service.createIndividualSession(
        'student-2',
        makeCreateDto({ scheduledDate: '2030-01-13' }),
      );
      expect(result2.success).toBe(true);

      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenNthCalledWith(1, 'tutor-1', 10, '2030-01-06', 1);
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenNthCalledWith(2, 'tutor-1', 10, '2030-01-13', 1);
    });

    it('rechaza agendamiento cuando el slot ya está confirmado para otro estudiante (lock pesimista)', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', [])) // dailySessions
        .mockReturnValueOnce(makeQb('getOne', { idSession: 'other-session' })); // confirmedInSlot

      await expect(
        service.createIndividualSession('student-1', makeCreateDto()),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rechaza agendamiento cuando la fecha no corresponde al día del slot de disponibilidad', async () => {
      validationService.validateScheduledDateMatchesSlotDay.mockRejectedValue(
        new BadRequestException(
          'La fecha 2030-01-07 corresponde a un martes, pero el slot solo está disponible los lunes.',
        ),
      );

      await expect(
        service.createIndividualSession(
          'student-1',
          makeCreateDto({ scheduledDate: '2030-01-07' }),
        ),
      ).rejects.toThrow(BadRequestException);

      // validateScheduledDateMatchesSlotDay lanza antes de entrar a la transacción
      expect(qrManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rechaza agendamiento con menos de 6 horas de anticipación', async () => {
      // validateMinimumBookingAdvance es síncrono y lanza directamente
      validationService.validateMinimumBookingAdvance.mockImplementation(() => {
        throw new BadRequestException(
          'Solo puedes agendar sesiones con al menos 6 horas de anticipación.',
        );
      });

      await expect(
        service.createIndividualSession('student-1', makeCreateDto()),
      ).rejects.toThrow(BadRequestException);

      // No debe haber llegado a la transacción
      expect(qrManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('llama validateMinimumBookingAdvance con la fecha y hora del slot', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.createIndividualSession('student-1', makeCreateDto());

      // startTime proviene de availabilityService.getAvailabilityById → '09:00'
      expect(
        validationService.validateMinimumBookingAdvance,
      ).toHaveBeenCalledWith('2030-01-06', '09:00');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LÍMITE SEMANAL DE HORAS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3 — Límite semanal de horas del tutor', () => {
    it('rechaza agendamiento cuando el tutor ya alcanzó su límite semanal de horas', async () => {
      validationService.validateWeeklyHoursLimit.mockRejectedValue(
        new BadRequestException(
          'El tutor ha alcanzado su límite semanal de 8h',
        ),
      );

      await expect(
        service.createIndividualSession('student-1', makeCreateDto()),
      ).rejects.toThrow(BadRequestException);

      // La validación semanal corre antes de la transacción
      expect(qrManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('permite dos sesiones en la misma semana mientras no se supere el límite semanal', async () => {
      // Primera sesión
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.createIndividualSession(
        'student-1',
        makeCreateDto({ scheduledDate: '2030-01-06' }),
      );

      // Segunda sesión — mismo tutor, diferente día de la misma semana
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ scheduledDate: '2030-01-07' }),
      );

      availabilityService.getAvailabilityById.mockResolvedValue({
        idAvailability: 11,
        dayOfWeek: 1, // martes
        startTime: '09:00',
      });

      const result2 = await service.createIndividualSession(
        'student-2',
        makeCreateDto({ scheduledDate: '2030-01-07', availabilityId: 11 }),
      );

      expect(result2.success).toBe(true);
      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalledTimes(
        2,
      );
    });

    it('rechaza propuesta de modificación cuando la nueva fecha excedería el límite semanal', async () => {
      validationService.validateWeeklyHoursLimit.mockRejectedValue(
        new BadRequestException(
          'El tutor ha alcanzado su límite semanal de 8h',
        ),
      );

      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      scheduledSessionRepo.findOne.mockResolvedValue({ idAvailability: 10 });

      await expect(
        service.proposeModification('student-1', 'session-1', {
          newScheduledDate: '2030-01-08',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('excluye la sesión actual al calcular horas semanales en proposeModification', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      scheduledSessionRepo.findOne.mockResolvedValue({ idAvailability: 10 });
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      await service.proposeModification('student-1', 'session-1', {
        newScheduledDate: '2030-01-13',
      });

      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-13',
        expect.any(Number),
        'session-1', // ← exclusión de la sesión actual
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CONFLICTOS DE HORARIO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('4 — Solapamiento de horarios', () => {
    it('rechaza agendamiento cuando el horario se solapa con una sesión existente del tutor', async () => {
      validationService.validateNoTimeConflict.mockRejectedValue(
        new BadRequestException(
          'Ya tienes una sesión de 09:00 a 10:00 el 2030-01-06. El horario propuesto (09:30–10:30) se solapa.',
        ),
      );

      await expect(
        service.createIndividualSession(
          'student-1',
          makeCreateDto({ durationHours: 1 }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite sesiones back-to-back (fin de una == inicio de la siguiente)', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(
          makeQb('getMany', [{ startTime: '09:00', endTime: '10:00' }]),
        )
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ startTime: '10:00', endTime: '11:00' }),
      );

      availabilityService.getAvailabilityById.mockResolvedValue({
        idAvailability: 11,
        dayOfWeek: 0,
        startTime: '10:00',
      });

      const result = await service.createIndividualSession(
        'student-2',
        makeCreateDto({ availabilityId: 11 }),
      );

      expect(result.success).toBe(true);
      expect(validationService.validateNoTimeConflict).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-06',
        '10:00',
        1,
      );
    });

    it('excluye la sesión actual al validar solapamiento en proposeModification', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      scheduledSessionRepo.findOne.mockResolvedValue({ idAvailability: 10 });
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      await service.proposeModification('student-1', 'session-1', {
        newScheduledDate: '2030-01-13',
      });

      expect(validationService.validateNoTimeConflict).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-13',
        '09:00',
        expect.any(Number),
        'session-1',
      );
    });

    it('llama validateNoTimeConflict con la fecha y hora correctas al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.createIndividualSession(
        'student-1',
        makeCreateDto({ scheduledDate: '2030-01-06', durationHours: 1 }),
      );

      expect(validationService.validateNoTimeConflict).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-06',
        '09:00',
        1,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. FLUJO MULTI-SOLICITUD: CONFIRMACIÓN Y AUTO-RECHAZO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('5 — Múltiples solicitudes para el mismo slot', () => {
    it('auto-rechaza solicitudes competidoras al confirmar una sesión', async () => {
      const pendingSession = makeSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        tutorConfirmed: false,
      });

      const competitor = makeSession({
        idSession: 'session-competitor',
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      });

      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', pendingSession)) // get session con lock
        .mockReturnValueOnce(makeQb('getOne', null)) // no conflicting confirmed
        .mockReturnValueOnce(makeQb('getMany', [])) // daySessions daily check
        .mockReturnValueOnce(
          makeQb('getMany', [
            { session: competitor, idSession: 'session-competitor' },
          ]),
        ); // pending competitors

      qrManager.findOne
        .mockResolvedValueOnce({
          idSession: 'session-1',
          idAvailability: 10,
          scheduledDate: '2030-01-06',
        }) // scheduledSession
        .mockResolvedValueOnce({ idStudent: 'student-2' }) // participation del competidor
        .mockResolvedValueOnce({ idStudent: 'student-1' }); // participation del confirmado

      sessionRepo.findOne.mockResolvedValue(makeSession());

      const result = await service.confirmSession('tutor-1', 'session-1', {});

      expect(competitor.status).toBe(SessionStatus.REJECTED_BY_TUTOR);
      expect(competitor.rejectionReason).toContain('confirmó');
      expect(result.autoRejectedCount).toBe(1);
      expect(notificationsService.sendSessionRejection).toHaveBeenCalledTimes(
        1,
      );
    });

    it('incluye el conteo de solicitudes pendientes en la respuesta al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 3)); // 3 solicitudes pendientes

      sessionRepo.findOne.mockResolvedValue(makeSession());

      const result = await service.createIndividualSession(
        'student-1',
        makeCreateDto(),
      );

      expect(result.pendingRequestsCount).toBe(3);
      expect(result.message).toContain('3');
    });

    it('rechaza confirmación cuando otro proceso ya confirmó el slot (conflicto en transacción)', async () => {
      const pendingSession = makeSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        tutorConfirmed: false,
      });

      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', pendingSession))
        .mockReturnValueOnce(
          makeQb('getOne', { idSession: 'already-confirmed' }),
        ); // conflict!

      qrManager.findOne.mockResolvedValueOnce({
        idSession: 'session-1',
        idAvailability: 10,
        scheduledDate: '2030-01-06',
      });

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CANCELACIÓN — REGLA DE 24H
  // ═══════════════════════════════════════════════════════════════════════════

  describe('6 — Regla de cancelación con 24 h de anticipación', () => {
    it('rechaza cancelación del estudiante con menos de 24 h de anticipación', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await expect(
        service.cancelSession('student-1', 'session-1', {
          reason: 'imprevisto',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(scheduledSessionRepo.delete).not.toHaveBeenCalled();
    });

    it('rechaza cancelación del tutor con menos de 24 h de anticipación', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await expect(
        service.cancelSession('tutor-1', 'session-1', { reason: 'emergencia' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite a un admin cancelar con menos de 24 h de anticipación', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      userService.isAdmin.mockResolvedValue(true);
      sessionRepo.findOne.mockResolvedValue(makeSession());

      const result = await service.cancelSession('admin-1', 'session-1', {
        reason: 'admin',
      });

      expect(result.success).toBe(true);
      expect(scheduledSessionRepo.delete).toHaveBeenCalledWith({
        idSession: 'session-1',
      });
    });

    it('marca cancelledWithin24h=true cuando admin cancela con menos de 24 h', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      userService.isAdmin.mockResolvedValue(true);
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);

      await service.cancelSession('admin-1', 'session-1', { reason: 'admin' });

      expect(session.cancelledWithin24h).toBe(true);
    });

    it('libera la franja eliminando ScheduledSession al cancelar correctamente', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.cancelSession('student-1', 'session-1', {
        reason: 'viaje',
      });

      expect(scheduledSessionRepo.delete).toHaveBeenCalledWith({
        idSession: 'session-1',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ESTADOS Y PERMISOS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('7 — Validación de estados y permisos', () => {
    it('rechaza cancelación de sesión que no está en estado SCHEDULED', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.CANCELLED_BY_TUTOR }),
      );

      await expect(
        service.cancelSession('student-1', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza confirmación de sesión que no está en PENDING_TUTOR_CONFIRMATION', async () => {
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', makeSession({ status: SessionStatus.SCHEDULED })),
      );

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cancelación de usuario que no es participante, tutor ni admin', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      userService.isAdmin.mockResolvedValue(false);

      await expect(
        service.cancelSession('stranger', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza agendamiento cuando el estudiante y el tutor son el mismo usuario', async () => {
      validationService.validateStudentNotTutor.mockImplementation(() => {
        throw new BadRequestException(
          'No puedes agendar una tutoría contigo mismo',
        );
      });

      await expect(
        service.createIndividualSession(
          'tutor-1',
          makeCreateDto({ tutorId: 'tutor-1' }),
        ),
      ).rejects.toThrow(BadRequestException);

      // No debe haber avanzado a validar el tutor activo
      expect(tutorService.validateTutorActive).not.toHaveBeenCalled();
    });

    it('rechaza propuesta de modificación para sesión en PENDING_MODIFICATION', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          status: SessionStatus.PENDING_MODIFICATION,
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );

      await expect(
        service.proposeModification('student-1', 'session-1', {
          newScheduledDate: '2030-01-13',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza respuesta a modificación cuando el respondedor es el mismo que la propuso', async () => {
      const session = makeSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = {
        idRequest: 'req-1',
        idSession: 'session-1',
        requestedBy: 'student-1',
        status: ModificationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      qrManager.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(request);
      qrManager.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      await expect(
        service.respondToModification('student-1', 'session-1', true, 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    // NUEVO — validar que proposeModification rechaza si faltan menos de 3 días
    it('rechaza propuesta de modificación si faltan 3 días o menos para la sesión', async () => {
      validationService.validateModificationAdvanceTime.mockImplementation(
        () => {
          throw new BadRequestException(
            'Solo puedes proponer modificaciones con más de 3 días de anticipación.',
          );
        },
      );

      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );

      await expect(
        service.proposeModification('student-1', 'session-1', {
          newScheduledDate: '2030-01-13',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // NUEVO — validar que se llama validateModificationAdvanceTime antes de las validaciones de slot
    it('llama validateModificationAdvanceTime con fecha y hora de la sesión actual', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      scheduledSessionRepo.findOne.mockResolvedValue({ idAvailability: 10 });
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      await service.proposeModification('student-1', 'session-1', {
        newScheduledDate: '2030-01-13',
      });

      expect(
        validationService.validateModificationAdvanceTime,
      ).toHaveBeenCalledWith(
        '2030-01-06', // scheduledDate de la sesión actual
        '09:00', // startTime de la sesión actual
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. PROPUESTA DE MODIFICACIÓN — VALIDACIONES DE NEGOCIO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('8 — Reglas de negocio en proposeModification', () => {
    it('rechaza propuesta de modificación que no incluye ningún cambio', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );

      await expect(
        service.proposeModification('student-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('no invoca validateAvailabilitySlotWithDuration al proponer solo cambio de modalidad', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      await service.proposeModification('student-1', 'session-1', {
        newModality: Modality.PRES,
      });

      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).not.toHaveBeenCalled();
      expect(validationService.validateNoTimeConflict).not.toHaveBeenCalled();
    });

    it('valida modalidad del nuevo slot al proponer cambio de availabilityId', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({
          studentParticipateSessions: [{ idStudent: 'student-1' }],
        }),
      );
      availabilityService.getAvailabilityById.mockResolvedValue({
        idAvailability: 20,
        dayOfWeek: 0,
        startTime: '11:00',
      });
      modificationRequestRepo.save.mockResolvedValue({
        idRequest: 'req-1',
        expiresAt: new Date(),
      });

      await service.proposeModification('student-1', 'session-1', {
        newAvailabilityId: 20,
        newScheduledDate: '2030-01-06',
      });

      expect(validationService.validateModality).toHaveBeenCalledWith(
        20,
        'tutor-1',
        'VIRT', // modality original de la sesión
      );
    });

    it('re-valida disponibilidad y solapamiento al aceptar una modificación (ventana de 24h)', async () => {
      const session = makeSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = {
        idRequest: 'req-1',
        idSession: 'session-1',
        requestedBy: 'student-1',
        status: ModificationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        newScheduledDate: '2030-01-13',
        newAvailabilityId: null,
        newModality: null,
        newDurationHours: null,
      };
      const scheduledSession = {
        idAvailability: 10,
        scheduledDate: '2030-01-06',
      };

      qrManager.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(scheduledSession);
      qrManager.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);

      sessionRepo.findOne.mockResolvedValue(
        makeSession({ subject: { idSubject: 'subject-1', name: 'Cálculo' } }),
      );

      await service.respondToModification(
        'tutor-1',
        'session-1',
        true,
        'req-1',
      );

      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalledWith(
        'tutor-1',
        10,
        '2030-01-13',
        expect.any(Number),
        'session-1',
      );
      expect(validationService.validateNoTimeConflict).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-13',
        '09:00',
        expect.any(Number),
        'session-1',
      );
      expect(validationService.validateDailyHoursLimit).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-13',
        expect.any(Number),
        'session-1',
      );
      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalledWith(
        'tutor-1',
        '2030-01-13',
        expect.any(Number),
        'session-1',
        expect.any(Object), // queryRunner
      );
    });

    it('restaura la sesión a SCHEDULED y marca la solicitud como EXPIRED si expiró', async () => {
      const session = makeSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = {
        idRequest: 'req-1',
        idSession: 'session-1',
        requestedBy: 'student-1',
        status: ModificationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000), // ya expiró
      };

      qrManager.findOne
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(request);
      qrManager.find.mockResolvedValueOnce([{ idStudent: 'student-1' }]);
      // count = 0 → no hay otras propuestas pendientes → sesión vuelve a SCHEDULED
      qrManager.count.mockResolvedValueOnce(0);

      await expect(
        service.respondToModification('tutor-1', 'session-1', true, 'req-1'),
      ).rejects.toThrow(BadRequestException);

      expect(request.status).toBe(ModificationStatus.EXPIRED);
      expect(session.status).toBe(SessionStatus.SCHEDULED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. NOTIFICACIONES — SIDE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('9 — Notificaciones como side effects del flujo', () => {
    it('envía notificación al tutor y acuse de recibo al estudiante al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.createIndividualSession('student-1', makeCreateDto());

      expect(
        notificationsService.sendTutorConfirmationRequest,
      ).toHaveBeenCalled();
      expect(
        notificationsService.sendStudentSessionRequestAck,
      ).toHaveBeenCalled();
    });

    it('no revierte la transacción si falla el envío de notificación', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getMany', []))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      notificationsService.sendTutorConfirmationRequest.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      const result = await service.createIndividualSession(
        'student-1',
        makeCreateDto(),
      );

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('envía notificación de cancelación al cancelar una sesión', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.cancelSession('student-1', 'session-1', {
        reason: 'viaje',
      });

      expect(notificationsService.sendSessionCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ idSession: 'session-1' }),
        'student-1',
      );
    });
  });
});
