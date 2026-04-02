import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Question } from '../modules/session-execution/entities/question.entity';
import { Answer } from '../modules/session-execution/entities/answer.entity';
import { StudentParticipateSession } from '../modules/scheduling/entities/student-participate-session.entity';
import { Session } from '../modules/scheduling/entities/session.entity';
import { User } from '../modules/users/entities/user.entity';
import { ParticipationStatus } from '../modules/scheduling/enums/participation-status.enum';

export class EvaluationSeeder {
  private readonly logger = new Logger(EvaluationSeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const questionRepo = dataSource.getRepository(Question);
    const answerRepo = dataSource.getRepository(Answer);
    const participationRepo = dataSource.getRepository(StudentParticipateSession);
    const sessionRepo = dataSource.getRepository(Session);
    const userRepo = dataSource.getRepository(User);

    // ─── PREGUNTAS DE EVALUACIÓN ───────────────────────────────────────────────
    const questionTexts = [
      '¿El tutor explicó los temas con claridad?',
      '¿El tutor respondió tus dudas satisfactoriamente?',
      '¿Los materiales y ejemplos utilizados fueron útiles?',
      '¿La sesión cumplió con tus expectativas académicas?',
      '¿Recomendarías este tutor a otros estudiantes?',
    ];

    const savedQuestions: Question[] = [];
    for (const content of questionTexts) {
      const exists = await questionRepo.findOne({ where: { content } });
      if (!exists) {
        const q = await questionRepo.save(questionRepo.create({ content }));
        savedQuestions.push(q);
      } else {
        savedQuestions.push(exists);
      }
    }
    this.logger.log(`${savedQuestions.length} questions seeded.`);

    const existingParticipations = await participationRepo.count();
    if (existingParticipations > 0) {
      this.logger.log('Participations already seeded. Skipping.');
      return;
    }

    // ─── BUSCAR SESIONES COMPLETADAS ──────────────────────────────────────────
    const carlos = await userRepo.findOne({ where: { email: 'carlos.ramirez@sgt.com' } });
    const maria  = await userRepo.findOne({ where: { email: 'maria.hernandez@sgt.com' } });
    const diego  = await userRepo.findOne({ where: { email: 'diego.torres@sgt.com' } });
    const laura  = await userRepo.findOne({ where: { email: 'laura.ospina@sgt.com' } });
    const sebas  = await userRepo.findOne({ where: { email: 'sebastian.mora@sgt.com' } });

    // Sesión 1 completada (Cálculo Diferencial - Carlos, 24 Mar)
    const session1 = await sessionRepo.findOne({
      where: { scheduledDate: new Date('2026-03-24') as any, idTutor: carlos?.idUser },
    });

    // Sesión 2 completada (Prog OOP - María, 26 Mar)
    const session2 = await sessionRepo.findOne({
      where: { scheduledDate: new Date('2026-03-26') as any, idTutor: maria?.idUser },
    });

    // Sesión 3 hoy (Álgebra Lineal - Carlos, 31 Mar) - registrados pero no evaluados aún
    const session3 = await sessionRepo.findOne({
      where: { scheduledDate: new Date('2026-03-31') as any, idTutor: carlos?.idUser },
    });

    // ─── PARTICIPACIONES EN SESIÓN 1 (Cálculo Diferencial) ────────────────────
    if (session1 && diego && sebas) {
      // Diego → ATTENDED + respuestas
      await participationRepo.save(participationRepo.create({
        idStudent: diego.idUser,
        idSession: session1.idSession,
        status: ParticipationStatus.ATTENDED,
        comment: 'Excelente sesión, entendí perfectamente los límites laterales.',
      }));

      const scores1 = [5, 5, 4, 5, 5];
      for (let i = 0; i < savedQuestions.length; i++) {
        await answerRepo.save(answerRepo.create({
          idQuestion: savedQuestions[i].idQuestion,
          idStudent: diego.idUser,
          idSession: session1.idSession,
          score: scores1[i],
        }));
      }
      this.logger.log('Participation seeded: Diego → Session1 (Cálculo) ATTENDED');

      // Sebastián → ATTENDED + respuestas
      await participationRepo.save(participationRepo.create({
        idStudent: sebas.idUser,
        idSession: session1.idSession,
        status: ParticipationStatus.ATTENDED,
        comment: 'Muy buena tutoría, aunque fue un poco rápida.',
      }));

      const scores2 = [4, 4, 4, 3, 4];
      for (let i = 0; i < savedQuestions.length; i++) {
        await answerRepo.save(answerRepo.create({
          idQuestion: savedQuestions[i].idQuestion,
          idStudent: sebas.idUser,
          idSession: session1.idSession,
          score: scores2[i],
        }));
      }
      this.logger.log('Participation seeded: Sebastián → Session1 (Cálculo) ATTENDED');
    }

    // ─── PARTICIPACIONES EN SESIÓN 2 (Prog OOP) ───────────────────────────────
    if (session2 && diego && laura) {
      // Diego → ATTENDED + respuestas
      await participationRepo.save(participationRepo.create({
        idStudent: diego.idUser,
        idSession: session2.idSession,
        status: ParticipationStatus.ATTENDED,
        comment: 'Muy útil, los ejemplos de interfaces fueron claros.',
      }));

      const scores3 = [5, 4, 5, 5, 5];
      for (let i = 0; i < savedQuestions.length; i++) {
        await answerRepo.save(answerRepo.create({
          idQuestion: savedQuestions[i].idQuestion,
          idStudent: diego.idUser,
          idSession: session2.idSession,
          score: scores3[i],
        }));
      }

      // Laura → ABSENT (no asistió)
      await participationRepo.save(participationRepo.create({
        idStudent: laura.idUser,
        idSession: session2.idSession,
        status: ParticipationStatus.ABSENT,
        comment: 'No pude conectarme por problemas de internet.',
      }));
      this.logger.log('Participation seeded: Diego → Session2 ATTENDED, Laura → ABSENT');
    }

    // ─── PARTICIPACIONES EN SESIÓN 3 (Hoy - Álgebra Lineal) ──────────────────
    if (session3 && diego && laura) {
      // Registrados para hoy (sin evaluar aún)
      await participationRepo.save(participationRepo.create({
        idStudent: diego.idUser,
        idSession: session3.idSession,
        status: ParticipationStatus.CONFIRMED,
      }));
      await participationRepo.save(participationRepo.create({
        idStudent: laura.idUser,
        idSession: session3.idSession,
        status: ParticipationStatus.CONFIRMED,
      }));
      this.logger.log('Participation seeded: Diego + Laura → Session3 CONFIRMED (today)');
    }

    this.logger.log('EvaluationSeeder completed.');
  }
}
