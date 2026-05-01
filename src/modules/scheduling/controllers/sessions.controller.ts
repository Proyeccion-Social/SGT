// src/scheduling/controllers/session.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionService } from '../services/session.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { CreateIndividualSessionDto } from '../dto/create-individual-session.dto';
import { CancelSessionDto } from '../dto/cancel-session.dto';
import { ProposeModificationDto } from '../dto/propose-modification.dto';
import { UpdateSessionDetailsDto } from '../dto/update-session-details.dto';
import { RejectSessionDto } from '../dto/reject-session.dto';
import { ConfirmSessionDto } from '../dto/confirm-session.dto';
import { SessionFilterDto } from '../dto/session-filter.dto';

@Controller('scheduling/sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  // ========================================
  // RF-19, RF-20: CREAR SESIÓN INDIVIDUAL
  // ========================================

  /**
   * POST /api/scheduling/sessions/individual
   * Crear sesión individual (solo estudiantes)
   */
  @Post('individual')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  async createIndividualSession(
    @CurrentUser() user: User,
    @Body() dto: CreateIndividualSessionDto,
  ) {
    return await this.sessionService.createIndividualSession(user.idUser, dto);
  }

  // ========================================
  // RF-20: CONFIRMAR SESIÓN (TUTOR)
  // ========================================

  /**
   * POST /api/scheduling/sessions/:id/confirm
   * Confirmar sesión pendiente (solo tutor)
   */
  @Post(':id/confirm')
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async confirmSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: ConfirmSessionDto,
  ) {
    const tutorId = user.idUser;
    return await this.sessionService.confirmSession(tutorId, sessionId, dto);
  }

  // ========================================
  // RF-20: RECHAZAR SESIÓN (TUTOR)
  // ========================================

  /**
   * POST /api/scheduling/sessions/:id/reject
   * Rechazar sesión pendiente (solo tutor)
   */
  @Post(':id/reject')
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async rejectSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: RejectSessionDto,
  ) {
    const tutorId = user.idUser;
    return await this.sessionService.rejectSession(tutorId, sessionId, dto);
  }

  // ========================================
  // RF-21: CANCELAR SESIÓN
  // ========================================

  /**
   * DELETE /api/sessions/:id
   * Cancelar sesión (estudiante, tutor o admin)
   */
  @Delete(':id')
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancelSession(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: CancelSessionDto,
  ) {
    return await this.sessionService.cancelSession(user.idUser, sessionId, dto);
  }

  // ========================================
  // RF-22: PROPONER MODIFICACIÓN
  // ========================================

  /**
   * POST /api/sessions/:id/propose-modification
   * Proponer modificación de sesión (estudiante o tutor)
   */
  @Post(':id/propose-modification')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async proposeModification(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: ProposeModificationDto,
  ) {
    return await this.sessionService.proposeModification(
      user.idUser,
      sessionId,
      dto,
    );
  }

  // ========================================
  // RF-22: RESPONDER A MODIFICACIÓN
  // ========================================

  /**
   * PATCH /api/sessions/:id/modifications/:requestId/accept
   * Aceptar modificación propuesta
   */
  @Patch(':id/modifications/:requestId/accept')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async acceptModification(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Param('requestId') requestId: string,
  ) {
    return await this.sessionService.respondToModification(
      user.idUser,
      sessionId,
      true, // accept = true
      requestId,
    );
  }

  /**
   * PATCH /api/sessions/:id/modifications/:requestId/reject
   * Rechazar modificación propuesta
   */
  @Patch(':id/modifications/:requestId/reject')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async rejectModification(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Param('requestId') requestId: string,
  ) {
    return await this.sessionService.respondToModification(
      user.idUser,
      sessionId,
      false, // accept = false
      requestId,
    );
  }

  // ========================================
  // RF-22: MODIFICAR TÍTULO/DESCRIPCIÓN
  // ========================================

  /**
   * PATCH /api/sessions/:id/details
   * Actualizar título y descripción de la sesión (tutor)
   * Nuevo cambio: solo el tutor puede hacerlo
   */
  @Patch(':id/details')
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async updateSessionDetails(
    @CurrentUser() user: User,
    @Param('id') sessionId: string,
    @Body() dto: UpdateSessionDetailsDto,
  ) {
    return await this.sessionService.updateSessionDetails(
      user.idUser,
      sessionId,
      dto,
    );
  }

  // ========================================
  // CONSULTAS
  // ========================================

  /**
   * GET /api/sessions/:id
   * Obtener detalles de una sesión (participantes o admin)
   */
  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  async getSessionById(@Param('id') sessionId: string) {
    return await this.sessionService.getSessionById(sessionId);
  }

  /**
   * GET /api/sessions/my-sessions/student?page=1&limit=10&status=SCHEDULED
   */
  @Get('my-sessions/student')
  @Roles(UserRole.STUDENT)
  async getMySessionsAsStudent(
    @CurrentUser() user: User,
    @Query() filters: SessionFilterDto,
  ) {
    return await this.sessionService.getMySessionsAsStudent(
      user.idUser,
      filters,
    );
  }

  /**
   * GET /api/sessions/my-sessions/tutor?page=1&limit=10&status=CANCELLED
   */
  @Get('my-sessions/tutor')
  @Roles(UserRole.TUTOR)
  async getMySessionsAsTutor(
    @CurrentUser() user: User,
    @Query() filters: SessionFilterDto,
  ) {
    return await this.sessionService.getMySessionsAsTutor(user.idUser, filters);
  }

  //Consultas para obtener detalles de propuestas de modificación

  /**
   * GET /api/sessions/:id/modification-requests
   * Obtener detalles de las propuestas de modificación usando el ID de la sesión (participantes o admin)
   */
  @Get(':id/modification-requests')
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  async getModificationRequestBySessionId(@Param('id') sessionId: string) {
    return await this.sessionService.getModificationsRequestBySessionId(
      sessionId,
    );
  }

  /**
   * GET /api/sessions/:id/modification-request
   * Obtener detalles de una propuesta de modificación usando el ID de la request (participantes o admin)
   */
  @Get(':id/modification-request')
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  async getModificationRequestById(@Param('id') requestId: string) {
    return await this.sessionService.getModificationRequestById(requestId);
  }
}
