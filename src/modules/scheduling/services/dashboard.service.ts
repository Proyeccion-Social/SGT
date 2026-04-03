// src/scheduling/services/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Session } from '../entities/session.entity';
import { StudentParticipateSession } from '../entities/student-participate-session.entity';
import { SessionStatus } from '../enums/session-status.enum';
import { ParticipationStatus } from '../enums/participation-status.enum';
import { TutorService } from '../../tutor/services/tutor.service';
import { startOfWeek, endOfWeek } from 'date-fns';
import {
  StudentDashboardResponseDto,
  TutorDashboardResponseDto,
  SessionCardDto,
} from '../dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(StudentParticipateSession, 'local')
    private readonly participationRepository: Repository<StudentParticipateSession>,

    private readonly tutorService: TutorService,
  ) {}

  // ========================================
  // STUDENT DASHBOARD
  // ========================================

  async getStudentDashboard(
    studentId: string,
  ): Promise<StudentDashboardResponseDto> {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const weeklySessionsCount = await this.participationRepository
      .createQueryBuilder('participation')
      .innerJoin('participation.session', 'session')
      .where('participation.idStudent = :studentId', { studentId })
      .andWhere('participation.status = :status', {
        status: ParticipationStatus.ATTENDED,
      })
      .andWhere('session.scheduledDate BETWEEN :weekStart AND :weekEnd', {
        weekStart,
        weekEnd,
      })
      .andWhere('session.status = :sessionStatus', {
        sessionStatus: SessionStatus.COMPLETED,
      })
      .getCount();

    const upcomingSessions = await this.getUpcomingOrHistorySessions(
      studentId,
      'student',
    );

    return {
      weeklySessionsCount,
      upcomingSessions,
    };
  }

  // ========================================
  // TUTOR DASHBOARD
  // ========================================

  async getTutorDashboard(tutorId: string): Promise<TutorDashboardResponseDto> {
    const weeklyHoursLimit = await this.tutorService.getWeeklyHoursLimit(tutorId);

    const { weeklyHoursUsed, weeklyHoursRemaining } =
      await this.calculateWeeklyHours(tutorId, weeklyHoursLimit);

    const upcomingSessions = await this.getUpcomingOrHistorySessions(
      tutorId,
      'tutor',
    );

    const totalStudentsReached = await this.getTotalStudentsReached(tutorId);

    return {
      weeklyHoursUsed,
      weeklyHoursLimit,
      weeklyHoursRemaining,
      upcomingSessions,
      totalStudentsReached,
    };
  }

  // ========================================
  // MÉTODOS PRIVADOS
  // ========================================

  private async calculateWeeklyHours(
    tutorId: string,
    weeklyHoursLimit: number,
  ): Promise<{ weeklyHoursUsed: number; weeklyHoursRemaining: number }> {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    const weekSessions = await this.sessionRepository.find({
      where: {
        idTutor: tutorId,
        scheduledDate: Between(weekStart, weekEnd),
        status: In([
          SessionStatus.SCHEDULED,
          SessionStatus.PENDING_MODIFICATION,
        ]),
      },
    });

    const weeklyHoursUsed = weekSessions.reduce((sum, session) => {
      const [startHour, startMin] = session.startTime.split(':').map(Number);
      const [endHour, endMin] = session.endTime.split(':').map(Number);
      const duration =
        (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
      return sum + duration;
    }, 0);

    const weeklyHoursRemaining = Math.max(0, weeklyHoursLimit - weeklyHoursUsed);

    return {
      weeklyHoursUsed: parseFloat(weeklyHoursUsed.toFixed(1)),
      weeklyHoursRemaining: parseFloat(weeklyHoursRemaining.toFixed(1)),
    };
  }

  private async getUpcomingOrHistorySessions(
    userId: string,
    role: 'student' | 'tutor',
  ): Promise<SessionCardDto[]> {
    const now = new Date();
     

  
    let sessions: Session[] = [];

    if (role === 'student') {
      // =========================
      // ESTUDIANTE
      // =========================
      sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .innerJoin('session.studentParticipateSessions', 'participation')
        .innerJoin('session.tutor', 'tutor')
        .innerJoin('tutor.user', 'tutorUser')
        .innerJoin('session.subject', 'subject')
        .where('participation.idStudent = :userId', { userId })
        .andWhere('session.scheduledDate >= :now', { now })
        .andWhere('session.status IN (:...statuses)', {
          statuses: [
            SessionStatus.SCHEDULED,
            SessionStatus.PENDING_TUTOR_CONFIRMATION,
            SessionStatus.PENDING_MODIFICATION,
          ],
        })
        .select([
          'session',
          'tutor.idUser',
          'tutor.user',
          'subject',
        ])
        .orderBy('session.scheduledDate', 'ASC')
        .addOrderBy('session.startTime', 'ASC')
        .take(5)
        .getMany();

      if (sessions.length === 0) {
        sessions = await this.sessionRepository
          .createQueryBuilder('session')
          .innerJoin('session.studentParticipateSessions', 'participation')
          .innerJoin('session.tutor', 'tutor')
          .innerJoin('tutor.user', 'tutorUser')
          .innerJoin('session.subject', 'subject')
          .where('participation.idStudent = :userId', { userId })
          .andWhere('session.status = :status', {
            status: 
              SessionStatus.COMPLETED,
              //SessionStatus.CANCELLED_BY_STUDENT, //Considerar sólo sesiones completadas en el historial
              //SessionStatus.CANCELLED_BY_TUTOR,
              //SessionStatus.REJECTED_BY_TUTOR,
            
          })
          .select([
            'session',
            'tutor.idUser',
            'tutor.user',
            'subject',
          ])
          .orderBy('session.scheduledDate', 'DESC')
          .addOrderBy('session.startTime', 'DESC')
          .take(5)
          .getMany();
      }
    } else {
      // =========================
      // TUTOR
      // =========================
      sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoin('session.studentParticipateSessions', 'participation')
        .leftJoin('participation.student', 'student')
        .leftJoin('student.user', 'studentUser')
        .innerJoin('session.subject', 'subject')
        .where('session.idTutor = :userId', { userId })
        .andWhere('session.scheduledDate >= :now', { now })
        .andWhere('session.status IN (:...statuses)', {
          statuses: [
            SessionStatus.SCHEDULED,
            SessionStatus.PENDING_TUTOR_CONFIRMATION,
            SessionStatus.PENDING_MODIFICATION,
          ],
        })
        .select([
          'session',
          'student.idUser',
          'student.user',
          'subject',
        ])
        .orderBy('session.scheduledDate', 'ASC')
        .addOrderBy('session.startTime', 'ASC')
        .take(5)
        .getMany();

        

      if (sessions.length === 0) {
        sessions = await this.sessionRepository
          .createQueryBuilder('session')
          .leftJoin('session.studentParticipateSessions', 'participation')
          .leftJoin('participation.student', 'student')
          .leftJoin('student.user', 'studentUser')
          .innerJoin('session.subject', 'subject')
          .where('session.idTutor = :userId', { userId })
          .andWhere('session.status = :status', {
            status: 
              SessionStatus.COMPLETED,
              //SessionStatus.CANCELLED_BY_TUTOR,
              //SessionStatus.CANCELLED_BY_STUDENT,
              //SessionStatus.REJECTED_BY_TUTOR,
          })
          .select([
            'session',
            'student.idUser',
            'student.user',
            'subject',
          ])
          .orderBy('session.scheduledDate', 'DESC')
          .addOrderBy('session.startTime', 'DESC')
          .take(5)
          .getMany();
      }
    }

    return sessions.map((session) => this.mapToSessionCard(session, role));
  }

  private mapToSessionCard(
  session: Session,
  role: 'student' | 'tutor',
): SessionCardDto {
  let otherPersonName: string;
  let otherPersonImage: string;

  if (role === 'student') {
    otherPersonName = session.tutor?.user?.name || 'Tutor';
    otherPersonImage = session.tutor?.urlImage || '/default-avatar.png';
  } else {
    const participation = session.studentParticipateSessions?.[0];
    const student = participation?.student;
    otherPersonName = student?.user?.name || 'Estudiante';
    otherPersonImage = '/default-avatar.png';
  }

  // Conversión segura de la fecha
  let scheduledDate: string;
  try {
    if (session.scheduledDate instanceof Date) {
      scheduledDate = session.scheduledDate.toISOString().split('T')[0];
    } else if (typeof session.scheduledDate === 'string') {
      // Si es string, tomar los primeros 10 caracteres (YYYY-MM-DD)
    scheduledDate = (session.scheduledDate as string).substring(0, 10);
    } else {
      scheduledDate = '';
    }
  } catch (error) {
    console.error('Error formateando fecha:', error);
    scheduledDate = '';
  }

  return {
    id: session.idSession,
    title: session.title,
    description: session.description,
    otherPersonName,
    otherPersonImage,
    subjectName: session.subject?.name || 'Materia',
    sessionType: session.type,
    modality: session.modality,
    scheduledDate,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
  };
}

  private async getTotalStudentsReached(tutorId: string): Promise<number> {
    const semesterStart = new Date('2026-01-01');

    const result = await this.participationRepository
      .createQueryBuilder('participation')
      .innerJoin('participation.session', 'session')
      .where('session.idTutor = :tutorId', { tutorId })
      .andWhere('session.scheduledDate >= :semesterStart', { semesterStart })
      .andWhere('participation.status = :status', {
        status: ParticipationStatus.ATTENDED,
      })
      .select('COUNT(DISTINCT participation.idStudent)', 'count')
      .getRawOne();

    return parseInt(result?.count || '0', 10);
  }
}