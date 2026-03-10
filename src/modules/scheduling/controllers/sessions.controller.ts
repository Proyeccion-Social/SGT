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
    );
  }

  // ========================================
  // RF-22: MODIFICAR TÍTULO/DESCRIPCIÓN
  // ========================================

  /**
   * PATCH /api/sessions/:id/details
   * Actualizar título y descripción de la sesión (estudiante o tutor)
   */
  @Patch(':id/details')
  @Roles(UserRole.STUDENT, UserRole.TUTOR)
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
   * GET /api/sessions/my-sessions/student
   * Obtener sesiones del estudiante actual
   */
  @Get('my-sessions/student')
  @Roles(UserRole.STUDENT)
  async getMySessionsAsStudent(@CurrentUser() user: User) {
    return await this.sessionService.getMySessionsAsStudent(user.idUser);
  }

  /**
   * GET /api/sessions/my-sessions/tutor
   * Obtener sesiones del tutor actual
   */
  @Get('my-sessions/tutor')
  @Roles(UserRole.TUTOR)
  async getMySessionsAsTutor(@CurrentUser() user: User) {
    return await this.sessionService.getMySessionsAsTutor(user.idUser);
  }
}