import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { AttendanceService } from '../services/attendance.service';
import { EvaluationService } from '../services/evaluation.service';
import { RatingQueryService } from '../services/rating-query.service';
import { RegisterStudentAttendanceDto } from '../dto/register-student-attendance.dto';
import { SendSessionEvaluationDto } from '../dto/send-session-evaluation.dto';
import { GetTutorEvaluationsQueryDto } from '../dto/get-tutor-evaluations-query.dto';
import { GetTutorMetricsQueryDto } from '../dto/get-tutor-metrics-query.dto';

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

  @Patch('sessions/:sessionId/attendance')
  @UseGuards(JwtAuthGuard)
  registerStudentAttendance(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Datos de entrada invalidos',
          }),
      }),
    )
    sessionId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Datos de entrada invalidos',
          }),
      }),
    )
    body: RegisterStudentAttendanceDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.TUTOR) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Solo los tutores pueden registrar asistencia',
      });
    }

    return this.attendanceService.registerStudentAttendance(
      sessionId,
      user.idUser,
      body,
    );
  }

  // ─── Evaluation ───────────────────────────────────────────────────────────

  @Get('evaluations/questions')
  @UseGuards(JwtAuthGuard)
  getEvaluationQuestionnaire(@CurrentUser() user: User) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Solo los estudiantes pueden acceder al cuestionario',
      });
    }

    return this.evaluationService.getEvaluationQuestionnaire();
  }

  @Post('sessions/:sessionId/evaluation')
  @UseGuards(JwtAuthGuard)
  sendSessionEvaluation(
    @Param(
      'sessionId',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Datos de entrada invalidos',
          }),
      }),
    )
    sessionId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Datos de entrada invalidos',
          }),
      }),
    )
    body: SendSessionEvaluationDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.STUDENT) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Solo los estudiantes pueden evaluar sesiones',
      });
    }

    return this.evaluationService.sendSessionEvaluation(
      sessionId,
      user.idUser,
      body,
    );
  }

  @Get('sessions/:sessionId/evaluation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  getSessionEvaluation(
    @CurrentUser() user: User,
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
    @Query(
      'studentId',
      new ParseUUIDPipe({
        optional: true,
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'studentId debe ser UUID valido',
          }),
      }),
    )
    studentId?: string,
  ) {
    return this.evaluationService.getSessionEvaluation(
      sessionId,
      user.idUser,
      user.role,
      studentId,
    );
  }

  // ─── Tutor Ratings ────────────────────────────────────────────────────────

  @Get('tutors/:tutorId/evaluations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  getTutorEvaluations(
    @CurrentUser() user: User,
    @Param(
      'tutorId',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'ID de tutor inválido',
          }),
      }),
    )
    tutorId: string,
    @Query(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Parámetros de consulta inválidos',
          }),
      }),
    )
    query: GetTutorEvaluationsQueryDto,
  ) {
    return this.evaluationService.getTutorEvaluations(
      tutorId,
      query.subjectId,
      query.startDate,
      query.endDate,
      query.page,
      query.limit,
    );
  }

  @Get('tutors/:tutorId/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR, UserRole.ADMIN)
  getTutorMetrics(
    @CurrentUser() user: User,
    @Param(
      'tutorId',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'ID de tutor inválido',
          }),
      }),
    )
    tutorId: string,
    @Query(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'Parámetros de consulta inválidos',
          }),
      }),
    )
    query: GetTutorMetricsQueryDto,
  ) {
    // Permission check: TUTOR solo ve sus propias métricas
    if (user.role === UserRole.TUTOR && user.idUser !== tutorId) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Solo puedes ver tus propias métricas',
      });
    }

    return this.evaluationService.getTutorMetrics(
      tutorId,
      query.startDate,
      query.endDate,
      query.subjectId,
    );
  }

}
