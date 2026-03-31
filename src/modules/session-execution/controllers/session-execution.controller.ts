import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GetTutorStatsDto } from '../dto/get-tutor-stats.dto';
import { SessionExecutionService } from '../services/session-execution.service';

@Controller('api/v1/session-execution')
export class SessionExecutionController {
  constructor(
    private readonly sessionExecutionService: SessionExecutionService,
  ) {}

  /**
   * GET /api/v1/session-execution/tutors/:tutorId/stats
   * RF40 (subset) - Obtiene métricas y estadísticas detalladas de un tutor.
   * Requiere rol TUTOR o ADMIN.
   */
  @Get('tutors/:tutorId/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  getTutorStats(
    @Param(
      'tutorId',
      new ParseUUIDPipe({
        version: '4',
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    tutorId: string,
    @Query() query: GetTutorStatsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.sessionExecutionService.getTutorStats(
      tutorId,
      query,
      currentUser,
    );
  }
}
