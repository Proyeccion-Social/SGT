// src/scheduling/dto/dashboard-response.dto.ts

export class StudentDashboardResponseDto {
  weeklySessionsCount: number;
  upcomingSessions: SessionCardDto[];
}

export class TutorDashboardResponseDto {
  weeklyHoursUsed: number;
  weeklyHoursLimit: number;
  weeklyHoursRemaining: number;
  upcomingSessions: SessionCardDto[];
  totalStudentsReached: number;
}

export class SessionCardDto {
  id: string;
  title: string;
  description: string;
  otherPersonName: string; // Tutor para estudiante, Estudiante para tutor
  otherPersonImage: string;
  subjectName: string;
  sessionType: 'INDIVIDUAL' | 'GROUP';
  modality: 'PRES' | 'VIRT';
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: string;
}
