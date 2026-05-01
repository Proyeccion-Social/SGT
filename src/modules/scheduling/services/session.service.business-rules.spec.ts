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
      validateStudentNotTutor: jest.fn(),
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
      calculateEndTime: jest.fn((start: string, hours: number) => {
        const [h, m] = start.split(':').map(Number);
        const totalMin = h * 60 + m + hours * 60;
        const rh = Math.floor(totalMin / 60);
        const rm = totalMin % 60;
        return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
      }),
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
    /**
     * CASO: slot 9:30–10:00 (último slot del tutor) + durationHours=1
     * → validateAvailabilitySlotWithDuration lanza ConflictException porque
     *   no hay slots contiguos para cubrir la hora completa.
     */
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
      ).toHaveBeenCalledWith(
        'tutor-1',
        10,
        '2030-01-06',
        1,
        // sin excludeSessionId porque es sesión nueva
      );
    });

    /**
     * CASO: slot 9:00–9:30 (único slot) + durationHours=0.5
     * → Exactamente cabe. Debe pasar.
     */
    it('permite agendamiento cuando la duración coincide exactamente con el único slot disponible', async () => {
      // happy path completo en el queryRunner
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' })) // daily hours check
        .mockReturnValueOnce(makeQb('getOne', null)) // confirmedInSlot
        .mockReturnValueOnce(makeQb('getCount', 0)); // pendingCount

      sessionRepo.findOne.mockResolvedValue(makeSession());

      const result = await service.createIndividualSession(
        'student-1',
        makeCreateDto({ durationHours: 0.5 }),
      );

      expect(result.success).toBe(true);
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenCalledWith('tutor-1', 10, '2030-01-06', 0.5);
    });

    /**
     * CASO: mismo slot de disponibilidad reservado en dos fechas distintas
     * → Son semanas distintas; no deben interferir entre sí.
     */
    it('permite reservar el mismo slot de disponibilidad en fechas distintas sin conflicto', async () => {
      // Primera llamada para '2030-01-06' (lunes semana 1)
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
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

      // Segunda llamada para '2030-01-13' (mismo slot, semana siguiente)
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
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

      // validateAvailabilitySlotWithDuration llamado dos veces con fechas diferentes
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenNthCalledWith(1, 'tutor-1', 10, '2030-01-06', 1);
      expect(
        validationService.validateAvailabilitySlotWithDuration,
      ).toHaveBeenNthCalledWith(2, 'tutor-1', 10, '2030-01-13', 1);
    });

    /**
     * CASO: El slot está ocupado con sesión CONFIRMADA (SCHEDULED).
     * La verificación pesimista dentro de la transacción debe bloquearlo.
     */
    it('rechaza agendamiento cuando el slot ya está confirmado para otro estudiante (lock pesimista)', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' })) // daily hours
        .mockReturnValueOnce(makeQb('getOne', { idSession: 'other-session' })); // confirmedInSlot

      await expect(
        service.createIndividualSession('student-1', makeCreateDto()),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    /**
     * CASO: Fecha no coincide con el día del slot (martes vs slot de lunes).
     * validateScheduledDateMatchesSlotDay debe lanzar antes de llegar a la BD.
     */
    it('rechaza agendamiento cuando la fecha no corresponde al día del slot de disponibilidad', async () => {
      validationService.validateScheduledDateMatchesSlotDay.mockRejectedValue(
        new BadRequestException(
          'La fecha 2030-01-07 corresponde a un martes, pero el slot solo está disponible los lunes.',
        ),
      );

      await expect(
        service.createIndividualSession(
          'student-1',
          makeCreateDto({ scheduledDate: '2030-01-07' }), // martes
        ),
      ).rejects.toThrow(BadRequestException);

      // No debe haber llegado a adquirir ningún lock
      expect(qrManager.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LÍMITE SEMANAL DE HORAS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3 — Límite semanal de horas del tutor', () => {
    /**
     * CASO: validateWeeklyHoursLimit lanza porque el tutor ya llegó al límite.
     * Debe propagarse como BadRequestException antes de entrar a la transacción.
     */
    it('rechaza agendamiento cuando el tutor ya alcanzó su límite semanal de horas', async () => {
      validationService.validateWeeklyHoursLimit.mockRejectedValue(
        new BadRequestException(
          'El tutor ha alcanzado su límite semanal de 8h',
        ),
      );

      await expect(
        service.createIndividualSession('student-1', makeCreateDto()),
      ).rejects.toThrow(BadRequestException);

      // No debe haber entrado al bloque transaccional (lock)
      expect(qrManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    /**
     * CASO: Mismo tutor agenda dos sesiones en la misma semana.
     * La segunda no debe verse afectada por la primera mientras no supere el límite.
     */
    it('permite dos sesiones en la misma semana mientras no se supere el límite semanal', async () => {
      // Primera sesión — happy path
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await service.createIndividualSession(
        'student-1',
        makeCreateDto({ scheduledDate: '2030-01-06' }),
      );

      // Segunda sesión — misma semana, diferente día
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ scheduledDate: '2030-01-07' }),
      );

      const result2 = await service.createIndividualSession(
        'student-2',
        makeCreateDto({ scheduledDate: '2030-01-07' }),
      );

      expect(result2.success).toBe(true);
      expect(validationService.validateWeeklyHoursLimit).toHaveBeenCalledTimes(
        2,
      );
    });

    /**
     * CASO: proposeModification con nueva fecha que excede el límite semanal.
     */
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

    /**
     * CASO: La exclusión de la sesión actual al proponer modificación
     * evita que se cuente dos veces en el límite semanal.
     */
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
        newScheduledDate: '2030-01-13', // semana siguiente
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
    /**
     * CASO: El tutor ya tiene una sesión 09:00–10:00 ese día.
     * Solicitud 09:30–10:30 → solapa → validateNoTimeConflict lanza.
     */
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

    /**
     * CASO: Sesiones back-to-back (09:00–10:00 y 10:00–11:00) NO se solapan.
     * validateNoTimeConflict no debe lanzar para la segunda.
     */
    it('permite sesiones back-to-back (fin de una == inicio de la siguiente)', async () => {
      // Segunda sesión 10:00–11:00 — no hay solapamiento
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '1' })) // 1h ya usada
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

    /**
     * CASO: Al proponer modificación, la sesión actual se excluye del chequeo
     * de solapamiento para que no se solape consigo misma.
     */
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
        '09:00', // startTime del slot actual
        expect.any(Number),
        'session-1', // ← exclusión
      );
    });

    /**
     * CASO: El estudiante intenta agendar en un horario donde ya tiene otra sesión.
     * validateNoTimeConflict aplica sobre el tutor, pero el front previene esto;
     * a nivel de servicio, la restricción de un solo slot por estudiante se garantiza
     * porque el estudiante solo puede tener un idStudent por sesión.
     * Verificamos que el servicio llama la validación con los parámetros correctos.
     */
    it('llama validateNoTimeConflict con la fecha y hora correctas al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
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
        '09:00', // startTime del availability
        1, // durationHours
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. FLUJO MULTI-SOLICITUD: CONFIRMACIÓN Y AUTO-RECHAZO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('5 — Múltiples solicitudes para el mismo slot', () => {
    /**
     * CASO: Dos estudiantes solicitan el mismo slot.
     * Al confirmar a uno, el otro debe quedar REJECTED_BY_TUTOR automáticamente.
     */
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
        .mockReturnValueOnce(makeQb('getOne', pendingSession)) // get session
        .mockReturnValueOnce(makeQb('getOne', null)) // no conflict confirmed
        .mockReturnValueOnce(makeQb('getMany', [])) // daySessions daily check
        .mockReturnValueOnce(
          makeQb('getMany', [
            // pending competitors
            { session: competitor, idSession: 'session-competitor' },
          ]),
        );

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

    /**
     * CASO: Se informa al estudiante cuántas solicitudes pendientes hay para el slot.
     */
    it('incluye el conteo de solicitudes pendientes en la respuesta al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
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

    /**
     * CASO: Intento de confirmar cuando otro tutor ya confirmó el mismo slot
     * (race condition resuelta por lock pesimista).
     */
    it('rechaza confirmación cuando otro proceso ya confirmó el slot (conflicto en transacción)', async () => {
      const pendingSession = makeSession({
        status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
        tutorConfirmed: false,
      });

      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getOne', pendingSession)) // get session
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
    /**
     * CASO: Estudiante cancela con menos de 24h → BadRequestException.
     */
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

    /**
     * CASO: Tutor cancela con menos de 24h → también debe fallar.
     */
    it('rechaza cancelación del tutor con menos de 24 h de anticipación', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      sessionRepo.findOne.mockResolvedValue(makeSession());

      await expect(
        service.cancelSession('tutor-1', 'session-1', { reason: 'emergencia' }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * CASO: Admin puede cancelar sin importar el tiempo restante.
     */
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

    /**
     * CASO: Al cancelar dentro de las 24h, cancelledWithin24h debe ser true.
     */
    it('marca cancelledWithin24h=true cuando admin cancela con menos de 24 h', async () => {
      validationService.validateCancellationTime.mockReturnValue(false);
      userService.isAdmin.mockResolvedValue(true);
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);

      await service.cancelSession('admin-1', 'session-1', { reason: 'admin' });

      expect(session.cancelledWithin24h).toBe(true);
    });

    /**
     * CASO: Cancelación válida libera la franja (scheduledSession eliminada).
     */
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
    /**
     * CASO: Estudiante intenta cancelar sesión que ya fue cancelada.
     */
    it('rechaza cancelación de sesión que no está en estado SCHEDULED', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ status: SessionStatus.CANCELLED_BY_TUTOR }),
      );

      await expect(
        service.cancelSession('student-1', 'session-1', { reason: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * CASO: Tutor intenta confirmar sesión que ya está SCHEDULED.
     */
    it('rechaza confirmación de sesión que no está en PENDING_TUTOR_CONFIRMATION', async () => {
      qrManager.createQueryBuilder.mockReturnValueOnce(
        makeQb('getOne', makeSession({ status: SessionStatus.SCHEDULED })),
      );

      await expect(
        service.confirmSession('tutor-1', 'session-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * CASO: Usuario externo intenta cancelar una sesión ajena.
     */
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

    /**
     * CASO: Estudiante = Tutor → no puede agendarse a sí mismo.
     */
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

      // Ninguna otra validación debe haberse invocado
      expect(tutorService.validateTutorActive).not.toHaveBeenCalled();
    });

    /**
     * CASO: proposeModification solo funciona con sesiones en estado SCHEDULED.
     */
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

    /**
     * CASO: El solicitante de una modificación no puede responder su propia propuesta.
     */
    it('rechaza respuesta a modificación cuando el respondedor es el mismo que la propuso', async () => {
      const session = makeSession({
        status: SessionStatus.PENDING_MODIFICATION,
      });
      const request = {
        idRequest: 'req-1',
        idSession: 'session-1',
        requestedBy: 'student-1', // student-1 la propuso
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
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. PROPUESTA DE MODIFICACIÓN — VALIDACIONES DE NEGOCIO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('8 — Reglas de negocio en proposeModification', () => {
    /**
     * CASO: Propuesta sin ningún campo de cambio debe fallar.
     */
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

    /**
     * CASO: Al cambiar solo la modalidad no deben invocarse validaciones de tiempo.
     */
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

    /**
     * CASO: Cambiar availabilityId sí requiere validar modalidad del nuevo slot.
     */
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

    /**
     * CASO: Al aceptar una modificación se re-validan disponibilidad y solapamiento
     * porque pudo haber cambiado el estado en las 24h de ventana.
     */
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

      await service.respondToModification(
        'tutor-1',
        'session-1',
        true,
        'req-1',
      );

      // Deben haberse re-validado al momento de aceptar
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
      );
    });

    /**
     * CASO: solicitud de modificación expirada → sesión vuelve a SCHEDULED.
     */
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

      await expect(
        service.respondToModification('tutor-1', 'session-1', true, 'req-1'),
      ).rejects.toThrow(BadRequestException);
      expect(request.status).toBe(ModificationStatus.EXPIRED);
      expect(session.status).toBe(SessionStatus.SCHEDULED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled(); // se commitea el estado expirado
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. NOTIFICACIONES — SIDE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('9 — Notificaciones como side effects del flujo', () => {
    /**
     * CASO: Crear sesión debe notificar al tutor y acusar recibo al estudiante.
     */
    it('envía notificación al tutor y acuse de recibo al estudiante al crear sesión', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
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

    /**
     * CASO: Un fallo en el envío de notificación no debe revertir la transacción.
     */
    it('no revierte la transacción si falla el envío de notificación', async () => {
      qrManager.createQueryBuilder
        .mockReturnValueOnce(makeQb('getRawOne', { totalHours: '0' }))
        .mockReturnValueOnce(makeQb('getOne', null))
        .mockReturnValueOnce(makeQb('getCount', 0));
      sessionRepo.findOne.mockResolvedValue(makeSession());

      notificationsService.sendTutorConfirmationRequest.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      // La operación debe completarse exitosamente a pesar del fallo en notificación
      const result = await service.createIndividualSession(
        'student-1',
        makeCreateDto(),
      );

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    /**
     * CASO: Cancelación notifica a todas las partes involucradas.
     */
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
