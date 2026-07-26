import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User, UserRole, UserStatus } from '../modules/users/entities/user.entity';
import {
  Student,
  PreferredModality,
} from '../modules/student/entities/student.entity';
import { Tutor } from '../modules/tutor/entities/tutor.entity';
import { Subject } from '../modules/subjects/entities/subjects.entity';
import { TutorImpartSubject } from '../modules/subjects/entities/tutor-subject.entity';
import { StudentInterestedSubject } from '../modules/subjects/entities/student-subject.entity';
import { Availability } from '../modules/availability/entities/availability.entity';
import { TutorHaveAvailability } from '../modules/availability/entities/tutor-availability.entity';
import { Modality } from '../modules/availability/enums/modality.enum';
import { Session as SchedulingSession } from '../modules/scheduling/entities/session.entity';
import { ScheduledSession } from '../modules/scheduling/entities/scheduled-session.entity';
import { SessionModificationRequest } from '../modules/scheduling/entities/session-modification-request.entity';
import { StudentParticipateSession } from '../modules/scheduling/entities/student-participate-session.entity';
import { Question, QuestionAspect } from '../modules/session-execution/entities/question.entity';
import { Answer } from '../modules/session-execution/entities/answer.entity';
import { SessionType } from '../modules/scheduling/enums/session-type.enum';
import { SessionStatus } from '../modules/scheduling/enums/session-status.enum';
import { ParticipationStatus } from '../modules/scheduling/enums/participation-status.enum';
import { AppNotification } from '../modules/app-notification/entities/app-notification.entity';
import { Session as AuthSession } from '../modules/auth/entities/session.entity';
import { AuditLog } from '../modules/auth/entities/audit-log.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../modules/auth/entities/email-verification-token.entity';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PASSWORD = 'Atlas1234!';
const HASH_ROUNDS = 10;

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.LOCAL_DB_HOST ?? 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT ?? '5432'),
  username: process.env.LOCAL_DB_USER ?? 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? '1234',
  database: process.env.LOCAL_DB_NAME ?? 'atlas-pruebas',
  synchronize: true,
  logging: false,
  entities: [
    User, Student, Tutor,
    Subject, TutorImpartSubject, StudentInterestedSubject,
    Availability, TutorHaveAvailability,
    SchedulingSession, ScheduledSession, SessionModificationRequest,
    StudentParticipateSession,
    Question, Answer,
    AppNotification,
    AuthSession, AuditLog, PasswordResetToken, EmailVerificationToken,
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS_DATA = [
  { name: 'Cálculo Diferencial',              color: '#FF6B6B', borderColor: '#C0392B' },
  { name: 'Cálculo Integral',                 color: '#FF8E53', borderColor: '#E67E22' },
  { name: 'Ecuaciones Diferenciales',         color: '#FFC300', borderColor: '#F39C12' },
  { name: 'Matemáticas Discretas',            color: '#2ECC71', borderColor: '#27AE60' },
  { name: 'Álgebra Lineal',                   color: '#1ABC9C', borderColor: '#16A085' },
  { name: 'Física Newtoniana',                color: '#3498DB', borderColor: '#2980B9' },
  { name: 'Programación Básica',              color: '#9B59B6', borderColor: '#8E44AD' },
  { name: 'Programación Orientada a Objetos', color: '#E91E63', borderColor: '#C2185B' },
  { name: 'Programación Avanzada',            color: '#607D8B', borderColor: '#455A64' },
];

const TUTORS_DATA = [
  { name: 'Carlos Ramírez',  email: 'carlos.ramirez@udistrital.edu.co',  phone: '3201234567' },
  { name: 'Ana Martínez',    email: 'ana.martinez@udistrital.edu.co',    phone: '3107654321' },
  { name: 'Luis Pérez',      email: 'luis.perez@udistrital.edu.co',      phone: '3159876543' },
  { name: 'María González',  email: 'maria.gonzalez@udistrital.edu.co',  phone: '3124567890' },
];

const STUDENTS_DATA = [
  { name: 'Sebastián Torres', email: 'sebastian.torres@udistrital.edu.co', career: 'Ingeniería de Sistemas',   modality: PreferredModality.PRES },
  { name: 'Valentina López',  email: 'valentina.lopez@udistrital.edu.co',  career: 'Ingeniería Industrial',    modality: PreferredModality.VIRT },
  { name: 'Andrés Morales',   email: 'andres.morales@udistrital.edu.co',   career: 'Ingeniería Electrónica',   modality: PreferredModality.PRES },
  { name: 'Camila Ruiz',      email: 'camila.ruiz@udistrital.edu.co',      career: 'Ingeniería de Sistemas',   modality: PreferredModality.VIRT },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  await dataSource.initialize();
  console.log('✅ Database connected');

  try {
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, HASH_ROUNDS);
    const now = new Date();

    // ── 1. SUBJECTS ─────────────────────────────────────────────────────────
    const subjectRepo = dataSource.getRepository(Subject);
    const subjects: Subject[] = [];

    for (const s of SUBJECTS_DATA) {
      let subj = await subjectRepo.findOne({ where: { name: s.name } });
      if (!subj) {
        subj = await subjectRepo.save(subjectRepo.create({ ...s, isActive: true }));
        console.log(`  [Subject] Created: ${s.name}`);
      }
      subjects.push(subj);
    }

    // ── 2. AVAILABILITY SLOTS (Mon-Fri, 07:00–17:00) ────────────────────────
    const availRepo = dataSource.getRepository(Availability);
    const availabilities: Availability[] = [];

    for (let day = 1; day <= 5; day++) {
      for (let hour = 7; hour <= 17; hour++) {
        const startTime = `${pad(hour)}:00:00`;
        let slot = await availRepo.findOne({ where: { dayOfWeek: day, startTime } });
        if (!slot) {
          slot = await availRepo.save(availRepo.create({ dayOfWeek: day, startTime }));
        }
        availabilities.push(slot);
      }
    }
    console.log(`  [Availability] ${availabilities.length} slots ready`);

    // ── 3. QUESTIONS ────────────────────────────────────────────────────────
    const questionRepo = dataSource.getRepository(Question);
    const questions: Question[] = [];

    const QUESTIONS_DATA = [
      { content: '¿Qué tan claro fue el tutor al explicar los temas?',          aspect: QuestionAspect.CLARITY,     label: 'Claridad',      displayOrder: 1 },
      { content: '¿El tutor mostró paciencia al resolver tus dudas?',           aspect: QuestionAspect.PATIENCE,    label: 'Paciencia',     displayOrder: 2 },
      { content: '¿El tutor fue puntual al inicio y fin de la sesión?',         aspect: QuestionAspect.PUNCTUALITY, label: 'Puntualidad',   displayOrder: 3 },
      { content: '¿El tutor demostró dominio del tema tratado?',                aspect: QuestionAspect.KNOWLEDGE,   label: 'Conocimiento',  displayOrder: 4 },
    ];

    for (const q of QUESTIONS_DATA) {
      let question = await questionRepo.findOne({ where: { aspect: q.aspect } });
      if (!question) {
        question = await questionRepo.save(questionRepo.create({
          ...q,
          description: null,
          required: true,
          minScore: 1,
          maxScore: 5,
          questionnaireVersion: '1.0',
          isActive: true,
        }));
        console.log(`  [Question] Created: ${q.label}`);
      }
      questions.push(question);
    }

    // ── 4. ADMIN USER ───────────────────────────────────────────────────────
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { email: 'admin@udistrital.edu.co' } });
    if (!adminUser) {
      adminUser = await userRepo.save(userRepo.create({
        name: 'Administrador SGT',
        email: 'admin@udistrital.edu.co',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        email_verified_at: now,
        failed_login_attempts: 0,
        locked_until: null,
        password_changed_at: null,
      }));
      console.log(`  [User/Admin] Created: ${adminUser.email}`);
    }

    // ── 5. TUTOR USERS + PROFILES ────────────────────────────────────────────
    const tutorRepo = dataSource.getRepository(Tutor);
    const tutors: Array<{ user: User; tutor: Tutor }> = [];

    for (const td of TUTORS_DATA) {
      let tutorUser = await userRepo.findOne({ where: { email: td.email } });
      if (!tutorUser) {
        tutorUser = await userRepo.save(userRepo.create({
          name: td.name,
          email: td.email,
          password: hashedPassword,
          role: UserRole.TUTOR,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          email_verified_at: now,
          failed_login_attempts: 0,
          locked_until: null,
          password_changed_at: null,
        }));
      }

      let tutorProfile = await tutorRepo.findOne({ where: { idUser: tutorUser.idUser } });
      if (!tutorProfile) {
        tutorProfile = await tutorRepo.save(tutorRepo.create({
          idUser: tutorUser.idUser,
          phone: td.phone,
          isActive: true,
          limitDisponibility: 8,
          profile_completed: true,
          urlImage: null,
        }));
      }
      tutors.push({ user: tutorUser, tutor: tutorProfile });
      console.log(`  [Tutor] ${td.name} — ${td.email}`);
    }

    // ── 6. STUDENT USERS + PROFILES ──────────────────────────────────────────
    const studentRepo = dataSource.getRepository(Student);
    const students: Array<{ user: User; student: Student }> = [];

    for (const sd of STUDENTS_DATA) {
      let studentUser = await userRepo.findOne({ where: { email: sd.email } });
      if (!studentUser) {
        studentUser = await userRepo.save(userRepo.create({
          name: sd.name,
          email: sd.email,
          password: hashedPassword,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          email_verified_at: now,
          failed_login_attempts: 0,
          locked_until: null,
          password_changed_at: null,
        }));
      }

      let studentProfile = await studentRepo.findOne({ where: { idUser: studentUser.idUser } });
      if (!studentProfile) {
        studentProfile = await studentRepo.save(studentRepo.create({
          idUser: studentUser.idUser,
          career: sd.career,
          preferredModality: sd.modality,
        }));
      }
      students.push({ user: studentUser, student: studentProfile });
      console.log(`  [Student] ${sd.name} — ${sd.email}`);
    }

    // ── 7. TUTOR ↔ SUBJECT ───────────────────────────────────────────────────
    // Carlos [0]: Cálculo Dif.[0], Integral[1], Física[5]
    // Ana    [1]: Ecua. Dif.[2],   Mat. Disc.[3], Álgebra[4]
    // Luis   [2]: Prog. Básica[6], POO[7],        Prog. Av.[8]
    // María  [3]: Cálculo Dif.[0], Álgebra[4],    POO[7]
    const tutorSubjectRepo = dataSource.getRepository(TutorImpartSubject);
    const tutorSubjectMap: Array<{ tutorIdx: number; subjectIndices: number[] }> = [
      { tutorIdx: 0, subjectIndices: [0, 1, 5] },
      { tutorIdx: 1, subjectIndices: [2, 3, 4] },
      { tutorIdx: 2, subjectIndices: [6, 7, 8] },
      { tutorIdx: 3, subjectIndices: [0, 4, 7] },
    ];

    for (const { tutorIdx, subjectIndices } of tutorSubjectMap) {
      const idTutor = tutors[tutorIdx].tutor.idUser;
      for (const si of subjectIndices) {
        const idSubject = subjects[si].idSubject;
        const exists = await tutorSubjectRepo.findOne({ where: { idTutor, idSubject } });
        if (!exists) {
          await tutorSubjectRepo.save(tutorSubjectRepo.create({ idTutor, idSubject }));
        }
      }
    }
    console.log('  [TutorSubject] Assignments done');

    // ── 8. STUDENT ↔ SUBJECT ────────────────────────────────────────────────
    // Sebastián [0]: Cálculo Dif.[0], Prog. Básica[6]
    // Valentina [1]: Mat. Disc.[3],   Álgebra[4]
    // Andrés    [2]: Física[5],       POO[7]
    // Camila    [3]: Cálculo Int.[1], Prog. Av.[8]
    const studentSubjectRepo = dataSource.getRepository(StudentInterestedSubject);
    const studentSubjectMap: Array<{ studentIdx: number; subjectIndices: number[] }> = [
      { studentIdx: 0, subjectIndices: [0, 6] },
      { studentIdx: 1, subjectIndices: [3, 4] },
      { studentIdx: 2, subjectIndices: [5, 7] },
      { studentIdx: 3, subjectIndices: [1, 8] },
    ];

    for (const { studentIdx, subjectIndices } of studentSubjectMap) {
      const idStudent = students[studentIdx].student.idUser;
      for (const si of subjectIndices) {
        const idSubject = subjects[si].idSubject;
        const exists = await studentSubjectRepo.findOne({ where: { idStudent, idSubject } });
        if (!exists) {
          await studentSubjectRepo.save(studentSubjectRepo.create({ idStudent, idSubject }));
        }
      }
    }
    console.log('  [StudentSubject] Assignments done');

    // ── 9. TUTOR AVAILABILITY ────────────────────────────────────────────────
    // Carlos [0]: Mon-Wed 08:00–11:00 PRES
    // Ana    [1]: Mon-Wed 14:00–17:00 VIRT
    // Luis   [2]: Mon-Fri 07:00–08:00 PRES
    // María  [3]: Thu-Fri 10:00–11:00 VIRT
    const tutorAvailRepo = dataSource.getRepository(TutorHaveAvailability);

    type AvailRule = {
      tutorIdx: number;
      days: number[];
      hours: number[];
      modality: Modality;
    };

    const availRules: AvailRule[] = [
      { tutorIdx: 0, days: [1, 2, 3], hours: [8, 9, 10, 11],  modality: Modality.PRES },
      { tutorIdx: 1, days: [1, 2, 3], hours: [14, 15, 16, 17], modality: Modality.VIRT },
      { tutorIdx: 2, days: [1, 2, 3, 4, 5], hours: [7, 8],    modality: Modality.PRES },
      { tutorIdx: 3, days: [4, 5], hours: [10, 11],            modality: Modality.VIRT },
    ];

    for (const rule of availRules) {
      const idTutor = tutors[rule.tutorIdx].tutor.idUser;
      for (const day of rule.days) {
        for (const hour of rule.hours) {
          const startTime = `${pad(hour)}:00:00`;
          const slot = availabilities.find(
            (a) => a.dayOfWeek === day && a.startTime.startsWith(`${pad(hour)}:`),
          );
          if (!slot) continue;
          const exists = await tutorAvailRepo.findOne({
            where: { idTutor, idAvailability: slot.idAvailability },
          });
          if (!exists) {
            await tutorAvailRepo.save(
              tutorAvailRepo.create({ idTutor, idAvailability: slot.idAvailability, modality: [rule.modality] }),
            );
          }
        }
      }
    }
    console.log('  [TutorAvailability] Rules applied');

    // ── 10. SESSIONS ─────────────────────────────────────────────────────────
    const sessionRepo = dataSource.getRepository(SchedulingSession);
    const scheduledSessionRepo = dataSource.getRepository(ScheduledSession);
    const spsRepo = dataSource.getRepository(StudentParticipateSession);
    const answerRepo = dataSource.getRepository(Answer);

    //
    // SESSION 1 — COMPLETED
    // Tutor: Carlos | Subject: Cálculo Diferencial | Student: Sebastián
    //
    const s1Tutor = tutors[0].tutor.idUser;
    const s1Subject = subjects[0].idSubject;
    const s1Date = '2026-05-05';
    const s1AvailSlot = availabilities.find(
      (a) => a.dayOfWeek === 1 && a.startTime.startsWith('08:'),
    )!;

    let session1 = await sessionRepo.findOne({
      where: { idTutor: s1Tutor, idSubject: s1Subject, scheduledDate: s1Date },
    });

    if (!session1) {
      session1 = await sessionRepo.save(sessionRepo.create({
        idTutor: s1Tutor,
        idSubject: s1Subject,
        scheduledDate: s1Date,
        startTime: '08:00:00',
        endTime: '09:00:00',
        title: 'Introducción a Límites y Derivadas',
        description: 'Sesión introductoria sobre límites, continuidad y derivadas básicas.',
        type: SessionType.INDIVIDUAL,
        modality: Modality.PRES,
        location: 'Sala 301 — Edificio de Ingenierías',
        status: SessionStatus.COMPLETED,
        tutorConfirmed: true,
        tutorConfirmedAt: new Date('2026-05-04T10:00:00Z'),
        cancelledWithin24h: false,
      }));

      await scheduledSessionRepo.save(scheduledSessionRepo.create({
        idSession: session1.idSession,
        idTutor: s1Tutor,
        idAvailability: s1AvailSlot.idAvailability,
        scheduledDate: s1Date,
      }));

      const sps1 = await spsRepo.save(spsRepo.create({
        idStudent: students[0].student.idUser,
        idSession: session1.idSession,
        status: ParticipationStatus.ATTENDED,
        comment: 'Excelente sesión, entendí muy bien los conceptos.',
        arrivalTime: new Date('2026-05-05T08:02:00Z'),
      }));

      // Evaluation answers — one per question
      const scoreMap: Record<QuestionAspect, number> = {
        [QuestionAspect.CLARITY]:     5,
        [QuestionAspect.PATIENCE]:    4,
        [QuestionAspect.PUNCTUALITY]: 5,
        [QuestionAspect.KNOWLEDGE]:   5,
      };
      const evalId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567801';

      for (const q of questions) {
        await answerRepo.save(answerRepo.create({
          idQuestion: q.idQuestion,
          idStudent: students[0].student.idUser,
          idSession: session1.idSession,
          evaluationId: evalId,
          score: scoreMap[q.aspect],
          questionnaireVersion: '1.0',
        }));
      }
      console.log('  [Session 1] COMPLETED with participation + answers');
    }

    //
    // SESSION 2 — SCHEDULED (GROUP)
    // Tutor: Ana | Subject: Álgebra Lineal | Students: Valentina + Andrés
    //
    const s2Tutor = tutors[1].tutor.idUser;
    const s2Subject = subjects[4].idSubject;
    const s2Date = '2026-05-20';
    const s2AvailSlot = availabilities.find(
      (a) => a.dayOfWeek === 3 && a.startTime.startsWith('14:'),
    )!;

    let session2 = await sessionRepo.findOne({
      where: { idTutor: s2Tutor, idSubject: s2Subject, scheduledDate: s2Date },
    });

    if (!session2) {
      session2 = await sessionRepo.save(sessionRepo.create({
        idTutor: s2Tutor,
        idSubject: s2Subject,
        scheduledDate: s2Date,
        startTime: '14:00:00',
        endTime: '15:00:00',
        title: 'Espacios Vectoriales y Transformaciones Lineales',
        description: 'Revisión de espacios vectoriales, bases ortonormales y transformaciones lineales.',
        type: SessionType.GROUP,
        modality: Modality.VIRT,
        virtualLink: 'https://meet.google.com/sgt-algebra-01',
        status: SessionStatus.SCHEDULED,
        tutorConfirmed: true,
        tutorConfirmedAt: new Date('2026-05-15T09:00:00Z'),
        cancelledWithin24h: false,
      }));

      await scheduledSessionRepo.save(scheduledSessionRepo.create({
        idSession: session2.idSession,
        idTutor: s2Tutor,
        idAvailability: s2AvailSlot.idAvailability,
        scheduledDate: s2Date,
      }));

      for (const st of [students[1], students[2]]) {
        await spsRepo.save(spsRepo.create({
          idStudent: st.student.idUser,
          idSession: session2.idSession,
          status: ParticipationStatus.CONFIRMED,
          arrivalTime: null,
        }));
      }
      console.log('  [Session 2] SCHEDULED with 2 participants');
    }

    // ── SUMMARY ──────────────────────────────────────────────────────────────
    console.log('\n✅ Seeding completed!');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`  Password (all users): ${SEED_PASSWORD}`);
    console.log(`  Admin:   admin@udistrital.edu.co`);
    console.log('  Tutors:');
    for (const t of TUTORS_DATA) console.log(`    • ${t.email}`);
    console.log('  Students:');
    for (const s of STUDENTS_DATA) console.log(`    • ${s.email}`);
    console.log('──────────────────────────────────────────────────────────');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

