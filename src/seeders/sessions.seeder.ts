import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Session } from '../modules/scheduling/entities/session.entity';
import { ScheduledSession } from '../modules/scheduling/entities/scheduled-session.entity';
import { SessionModificationRequest } from '../modules/scheduling/entities/session-modification-request.entity';
import { Availability } from '../modules/availability/entities/availability.entity';
import { Subject } from '../modules/subjects/entities/subjects.entity';
import { User } from '../modules/users/entities/user.entity';
import { SessionType } from '../modules/scheduling/enums/session-type.enum';
import { SessionStatus } from '../modules/scheduling/enums/session-status.enum';
import { Modality } from '../modules/availability/enums/modality.enum';
import { ModificationStatus } from '../modules/scheduling/enums/modification-status.enum';

export class SessionsSeeder {
  private readonly logger = new Logger(SessionsSeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const sessionRepo = dataSource.getRepository(Session);
    const scheduledRepo = dataSource.getRepository(ScheduledSession);
    const modReqRepo = dataSource.getRepository(SessionModificationRequest);
    const availRepo = dataSource.getRepository(Availability);
    const subjectRepo = dataSource.getRepository(Subject);
    const userRepo = dataSource.getRepository(User);

    // Chequeo idempotente
    const existingCount = await sessionRepo.count();
    if (existingCount > 0) {
      this.logger.log(`Sessions already seeded (${existingCount} sessions found). Skipping.`);
      return;
    }

    // ─── BUSCAR TUTORES Y MATERIAS ─────────────────────────────────────────────
    const carlos = await userRepo.findOne({ where: { email: 'carlos.ramirez@sgt.com' } });
    const maria  = await userRepo.findOne({ where: { email: 'maria.hernandez@sgt.com' } });
    const diego  = await userRepo.findOne({ where: { email: 'diego.torres@sgt.com' } });
    const laura  = await userRepo.findOne({ where: { email: 'laura.ospina@sgt.com' } });
    const admin  = await userRepo.findOne({ where: { email: 'admin@sgt.com' } });

    const calcDif    = await subjectRepo.findOne({ where: { name: 'Cálculo Diferencial' } });
    const algebraLin = await subjectRepo.findOne({ where: { name: 'Álgebra Lineal' } });
    const progOOP    = await subjectRepo.findOne({ where: { name: 'Programación Orientada a Objetos' } });
    const progBasica = await subjectRepo.findOne({ where: { name: 'Programación Básica' } });

    // Slots de disponibilidad
    const slotLunes8    = await availRepo.findOne({ where: { dayOfWeek: 1, startTime: '08:00:00' } });
    const slotMartes8   = await availRepo.findOne({ where: { dayOfWeek: 2, startTime: '08:00:00' } });
    const slotMierc8    = await availRepo.findOne({ where: { dayOfWeek: 3, startTime: '08:00:00' } });
    const slotJueves8   = await availRepo.findOne({ where: { dayOfWeek: 4, startTime: '08:00:00' } });

    if (!carlos || !maria || !calcDif || !algebraLin || !progOOP || !progBasica) {
      this.logger.error('Missing required tutors or subjects. Run previous seeders first.');
      return;
    }

    // ─── SESIÓN 1: COMPLETADA (24 Mar, Lunes) ─────────────────────────────────
    const session1 = await sessionRepo.save(sessionRepo.create({
      idTutor: carlos.idUser,
      idSubject: calcDif.idSubject,
      scheduledDate: new Date('2026-03-24'),
      startTime: '08:00:00',
      endTime: '09:00:00',
      title: 'Tutoría: Límites y Continuidad',
      description: 'Repaso de límites laterales, continuidad en un punto y al infinito.',
      type: SessionType.GROUP,
      modality: Modality.PRES,
      location: 'Sala 201 - Bloque B',
      status: SessionStatus.COMPLETED,
      tutorConfirmed: true,
      tutorConfirmedAt: new Date('2026-03-23T10:00:00'),
    }));
    this.logger.log('Session 1 seeded: Cálculo Diferencial COMPLETED');

    if (slotLunes8) {
      await scheduledRepo.save(scheduledRepo.create({
        idTutor: carlos.idUser,
        idAvailability: slotLunes8.idAvailability,
        idSession: session1.idSession,
        scheduledDate: new Date('2026-03-24'),
      }));
    }

    // ─── SESIÓN 2: COMPLETADA (26 Mar, Miércoles) ─────────────────────────────
    const session2 = await sessionRepo.save(sessionRepo.create({
      idTutor: maria.idUser,
      idSubject: progOOP.idSubject,
      scheduledDate: new Date('2026-03-26'),
      startTime: '08:00:00',
      endTime: '09:30:00',
      title: 'Tutoría: Herencia y Polimorfismo en Java',
      description: 'Ejemplos prácticos de herencia múltiple via interfaces y polimorfismo en tiempo de ejecución.',
      type: SessionType.GROUP,
      modality: Modality.VIRT,
      virtualLink: 'https://meet.google.com/abc-defg-hij',
      status: SessionStatus.COMPLETED,
      tutorConfirmed: true,
      tutorConfirmedAt: new Date('2026-03-25T09:00:00'),
    }));
    this.logger.log('Session 2 seeded: Prog OOP COMPLETED');

    if (slotMierc8) {
      await scheduledRepo.save(scheduledRepo.create({
        idTutor: maria.idUser,
        idAvailability: slotMierc8.idAvailability,
        idSession: session2.idSession,
        scheduledDate: new Date('2026-03-26'),
      }));
    }

    // ─── SESIÓN 3: SCHEDULED - HOY (31 Mar, Martes) ───────────────────────────
    const session3 = await sessionRepo.save(sessionRepo.create({
      idTutor: carlos.idUser,
      idSubject: algebraLin.idSubject,
      scheduledDate: new Date('2026-03-31'),
      startTime: '08:00:00',
      endTime: '09:00:00',
      title: 'Tutoría: Vectores y Matrices',
      description: 'Operaciones con matrices, determinantes y sistemas de ecuaciones lineales.',
      type: SessionType.INDIVIDUAL,
      modality: Modality.PRES,
      location: 'Sala 105 - Bloque A',
      status: SessionStatus.SCHEDULED,
      tutorConfirmed: true,
      tutorConfirmedAt: new Date('2026-03-30T14:00:00'),
    }));
    this.logger.log('Session 3 seeded: Álgebra Lineal SCHEDULED (today)');

    if (slotMartes8) {
      await scheduledRepo.save(scheduledRepo.create({
        idTutor: carlos.idUser,
        idAvailability: slotMartes8.idAvailability,
        idSession: session3.idSession,
        scheduledDate: new Date('2026-03-31'),
      }));
    }

    // ─── SESIÓN 4: SCHEDULED - FUTURO (3 Abr, Jueves) ────────────────────────
    const session4 = await sessionRepo.save(sessionRepo.create({
      idTutor: maria.idUser,
      idSubject: progBasica.idSubject,
      scheduledDate: new Date('2026-04-03'),
      startTime: '08:00:00',
      endTime: '09:00:00',
      title: 'Tutoría: Introducción a Python',
      description: 'Variables, tipos de datos, condicionales y ciclos en Python.',
      type: SessionType.GROUP,
      modality: Modality.VIRT,
      virtualLink: 'https://meet.google.com/xyz-uvwx-yzk',
      status: SessionStatus.PENDING_TUTOR_CONFIRMATION,
      tutorConfirmed: false,
    }));
    this.logger.log('Session 4 seeded: Programación Básica PENDING_TUTOR_CONFIRMATION (future)');

    if (slotJueves8) {
      await scheduledRepo.save(scheduledRepo.create({
        idTutor: maria.idUser,
        idAvailability: slotJueves8.idAvailability,
        idSession: session4.idSession,
        scheduledDate: new Date('2026-04-03'),
      }));
    }

    // ─── SESSION MODIFICATION REQUESTS ────────────────────────────────────────
    const now = new Date('2026-03-31T22:00:00-05:00');

    if (diego) {
      // 1. Solicitud VIGENTE (sobre sesión 4 futura) - expira en 24h
      await modReqRepo.save(modReqRepo.create({
        idSession: session4.idSession,
        requestedBy: diego.idUser,
        newScheduledDate: new Date('2026-04-07'), // quiere moverla al 7 de abril
        newStartTime: '10:00:00',
        newModality: Modality.PRES,
        status: ModificationStatus.PENDING,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // +24h
      }));
      this.logger.log('ModificationRequest seeded: PENDING (vigente)');
    }

    if (laura && admin) {
      // 2. Solicitud EXPIRADA (sobre sesión 2 pasada)
      const expiredAt = new Date('2026-03-26T08:00:00');
      await modReqRepo.save(modReqRepo.create({
        idSession: session2.idSession,
        requestedBy: laura.idUser,
        newScheduledDate: new Date('2026-03-27'),
        newStartTime: '10:00:00',
        status: ModificationStatus.EXPIRED,
        expiresAt: expiredAt,
        respondedAt: expiredAt,
        respondedBy: admin.idUser,
      }));
      this.logger.log('ModificationRequest seeded: EXPIRED');
    }

    this.logger.log('SessionsSeeder completed.');
  }
}
