export class SessionRatingsResponseDto {
  clarity: number;
  patience: number;
  punctuality: number;
  knowledge: number;
}

export class EvaluationDetailDto {
  evaluationId: string;
  studentId?: string;
  studentName?: string;
  ratings: SessionRatingsResponseDto;
  overallRating: number;
  comments?: string;
  evaluatedAt: string;
}

export class GetSessionEvaluationResponseDto {
  evaluationId: string;
  sessionId: string;
  sessionDate: string;
  tutorId: string;
  tutorName: string;
  subjectName: string;
  evaluations: EvaluationDetailDto[];
  averageRating: number;
  totalEvaluations: number;
}
