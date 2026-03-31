import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GetTutorStatsDto } from '../dto/get-tutor-stats.dto';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export interface TutorStatsResponse {
  tutorId: string;
  tutorName: string;
  period: {
    startDate: string | null;
    endDate: string | null;
    description: string;
  };
  ratingMetrics: {
    averageOverall: number;
    totalEvaluations: number;
    averageByAspect: {
      clarity: number;
      patience: number;
      punctuality: number;
      knowledge: number;
      usefulness: number;
    };
    ratingDistribution: Record<string, number>;
  };
  sessionMetrics: {
    totalSessionsCompleted: number;
    sessionsByType: { individual: number; collaborative: number };
    sessionsByModality: { presencial: number; virtual: number };
    sessionsBySubject: Array<{
      subjectId: string;
      subjectName: string;
      count: number;
    }>;
  };
  attendanceMetrics: {
    attendanceRate: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    noShowCount: number;
  };
  temporalMetrics: {
    sessionsByMonth: Array<{
      month: string;
      sessions: number;
      averageRating: number;
    }>;
  };
  calculatedAt: string;
}

@Injectable()
export class SessionExecutionService {
  getTutorStats(
    tutorId: string,
    query: GetTutorStatsDto,
    currentUser: AuthenticatedUser,
  ): TutorStatsResponse {
    this.validateCanViewTutorStats(tutorId, currentUser);
    this.validateDateRange(query.startDate, query.endDate);

    const period = this.buildPeriod(query.startDate, query.endDate);

    return {
      tutorId,
      tutorName: 'Carlos Andrés Pérez',
      period,
      ratingMetrics: {
        averageOverall: 4.7,
        totalEvaluations: 45,
        averageByAspect: {
          clarity: 4.8,
          patience: 4.9,
          punctuality: 4.6,
          knowledge: 4.7,
          usefulness: 4.8,
        },
        ratingDistribution: { '5': 25, '4': 15, '3': 4, '2': 1, '1': 0 },
      },
      sessionMetrics: {
        totalSessionsCompleted: 67,
        sessionsByType: { individual: 45, collaborative: 22 },
        sessionsByModality: { presencial: 40, virtual: 27 },
        sessionsBySubject: [
          {
            subjectId: '00000000-0000-0000-0000-000000000001',
            subjectName: 'Programación I',
            count: 35,
          },
          {
            subjectId: '00000000-0000-0000-0000-000000000002',
            subjectName: 'Estructuras de Datos',
            count: 32,
          },
        ],
      },
      attendanceMetrics: {
        attendanceRate: 94.0,
        presentCount: 63,
        absentCount: 2,
        lateCount: 2,
        noShowCount: 0,
      },
      temporalMetrics: {
        sessionsByMonth: [
          { month: '2024-12', sessions: 12, averageRating: 4.6 },
          { month: '2025-01', sessions: 8, averageRating: 4.8 },
        ],
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  private validateCanViewTutorStats(
    tutorId: string,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === 'ADMIN') {
      return;
    }

    if (
      currentUser.role === 'TUTOR' &&
      currentUser.tutorId !== tutorId &&
      currentUser.sub !== tutorId
    ) {
      throw new ForbiddenException('Solo puedes ver tus propias métricas');
    }
  }

  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        throw new BadRequestException('Rango de fechas inválido');
      }
    }
  }

  private buildPeriod(
    startDate?: string,
    endDate?: string,
  ): TutorStatsResponse['period'] {
    if (!startDate && !endDate) {
      return {
        startDate: null,
        endDate: null,
        description: 'Todas las métricas históricas',
      };
    }
    if (startDate && endDate) {
      return {
        startDate,
        endDate,
        description: `Métricas del período ${startDate} al ${endDate}`,
      };
    }
    if (startDate) {
      return {
        startDate,
        endDate: null,
        description: `Métricas desde ${startDate}`,
      };
    }
    return {
      startDate: null,
      endDate: endDate ?? null,
      description: `Métricas hasta ${endDate ?? ''}`,
    };
  }
}
