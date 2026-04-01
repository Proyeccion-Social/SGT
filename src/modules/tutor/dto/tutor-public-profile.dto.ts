// src/tutor/dto/tutor-public-profile.dto.ts
export class TutorPublicProfileDto {
  id: string;
  name: string;
  photo: string | null;
  subjects: Array<{
    id: string;
    name: string;
  }>;
  averageRating: number;
  totalRatings: number;
  completedSessions: number;
  availableModalities: string[];
  maxWeeklyHours: number;
  currentWeekHoursUsed: number;
  availableHoursThisWeek: number;
}
