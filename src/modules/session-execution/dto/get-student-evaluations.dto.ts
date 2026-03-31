export class StudentEvaluationRatingsDto {
  clarity: number;
  patience: number;
  punctuality: number;
  knowledge: number;
}

export class StudentEvaluationItemDto {
  evaluationId: string;
  sessionId: string;
  sessionDate: string;
  tutorId: string;
  tutorName: string;
  subjectName: string;
  ratings: StudentEvaluationRatingsDto;
  overallRating: number;
  comments: string | null;
  evaluatedAt: string;
}

export class StudentEvaluationSummaryDto {
  totalEvaluations: number;
  averageRatingGiven: number;
}

export class StudentEvaluationPaginationDto {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

export class StudentEvaluationFiltersDto {
  tutorId: string | null;
  subjectId: string | null;
  startDate: string | null;
  endDate: string | null;
}

export class GetStudentEvaluationsResponseDto {
  studentId: string;
  studentName: string;
  evaluations: StudentEvaluationItemDto[];
  summary: StudentEvaluationSummaryDto;
  pagination: StudentEvaluationPaginationDto;
  filters: StudentEvaluationFiltersDto;
}
