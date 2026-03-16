import { Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { AttendanceService } from '../services/attendance.service';
import { EvaluationService } from '../services/evaluation.service';
import { RatingQueryService } from '../services/rating-query.service';

@Controller('session-execution')
export class SessionExecutionController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly evaluationService: EvaluationService,
    private readonly ratingQueryService: RatingQueryService,
  ) {}

  // ─── Attendance ───────────────────────────────────────────────────────────


  // ─── Evaluation ───────────────────────────────────────────────────────────

 

  // ─── Tutor Ratings ────────────────────────────────────────────────────────

}
