import {
  BadRequestException,
  Controller,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
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

  @Patch('sessions/:sessionId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  registerCompletedSession(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'ID de sesion invalido',
          }),
      }),
    )
    sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.registerCompletedSession(sessionId, user.idUser);
  }

  // ─── Evaluation ───────────────────────────────────────────────────────────

  // ─── Tutor Ratings ────────────────────────────────────────────────────────

}
