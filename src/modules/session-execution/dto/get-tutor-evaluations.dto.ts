export class TutorRatingsDto {
  clarity: number;
  patience: number;
  punctuality: number;
  knowledge: number;
}

export class TutorEvaluationDetailDto {
  evaluationId: string;
  sessionId: string;
  sessionDate: string;
  subjectName: string;
  ratings: TutorRatingsDto;
  overallRating: number;
  comments?: string;
  evaluatedAt: string;
}

export class TutorEvaluationSummaryDto {
  totalEvaluations: number;
  averageRating: number;
  ratingsByAspect: TutorRatingsDto;
  averageBySubject?: Record<string, number>;
}

export class PaginationDto {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

export class FiltersAppliedDto {
  subjectId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export class GetTutorEvaluationsResponseDto {
  tutorId: string;
  tutorName: string;
  summary: TutorEvaluationSummaryDto;
  evaluations: TutorEvaluationDetailDto[];
  pagination: PaginationDto;
  filters: FiltersAppliedDto;
}
