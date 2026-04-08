export class RatingMetricsDto {
  averageOverall: number;
  totalEvaluations: number;
  averageByAspect: {
    clarity: number;
    patience: number;
    punctuality: number;
    knowledge: number;
  };
  ratingDistribution: {
    [key: number]: number; // 1-5 mapped to count
  };
}

export class SessionsByTypeDto {
  individual: number;
  collaborative: number; // GROUP sessions
}

export class SessionsByModalityDto {
  presencial: number;
  virtual: number;
}

export class SessionBySubjectDto {
  subjectId: string;
  subjectName: string;
  count: number;
}

export class SessionMetricsDto {
  totalSessionsCompleted: number;
  sessionsByType: SessionsByTypeDto;
  sessionsByModality: SessionsByModalityDto;
  sessionsBySubject: SessionBySubjectDto[];
}

export class AttendanceMetricsDto {
  attendanceRate: number; // percentage
  presentCount: number;
  absentCount: number;
  lateCount: number;
  noShowCount: number; // mapped from count of sessions with no participation record
}

export class SessionByMonthDto {
  month: string; // YYYY-MM format
  sessions: number;
  averageRating: number;
}

export class TemporalMetricsDto {
  sessionsByMonth: SessionByMonthDto[];
}

export class PeriodDto {
  startDate: string | null;
  endDate: string | null;
  description: string;
}

export class GetTutorMetricsResponseDto {
  tutorId: string;
  tutorName: string;
  period: PeriodDto;
  ratingMetrics: RatingMetricsDto;
  sessionMetrics: SessionMetricsDto;
  attendanceMetrics: AttendanceMetricsDto;
  temporalMetrics: TemporalMetricsDto;
  calculatedAt: string;
}
