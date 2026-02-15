// src/tutor/controllers/tutors.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from 'src/modules/users/services/users.service';
import { TutorService } from '../services/tutor.service';
import { SubjectsService } from '../../subjects/services/subjects.service';
import { CompleteTutorProfileDto } from '../dto/complete-tutor-profile.dto';
import { AssignSubjectsDto } from 'src/modules/subjects/dto/assign-subjects.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('tutors')
export class TutorsController {
  constructor(
    private tutorService: TutorService,
    private readonly userService: UserService,
    private readonly subjectsService: SubjectsService,
  ) { }

  // =====================================================
  // POST /api/v1/tutors/profile/complete
  // RF09: Completar perfil de tutor (solo TUTOR autenticado)
  // =====================================================
  @Post('profile/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async completeProfile(
    @CurrentUser() user: User,
    @Body() dto: CompleteTutorProfileDto,
  ) {
    return this.tutorService.completeProfile(user.idUser, dto);
  }

  // =====================================================
  // GET /api/v1/tutors/:id
  // RF11: Consultar perfil público de tutor (sin autenticación)
  // =====================================================
  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.tutorService.getPublicProfile(id);
  }

  // =====================================================
  // GET /api/v1/tutors/me/status
  // Verificar estado del perfil del tutor autenticado
  // =====================================================
  @Get('me/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  async getMyStatus(@CurrentUser() user: User) {
    const hasTemporaryPassword = await this.userService.hasTemporaryPassword(
      user.idUser,
    );
    const profileCompleted = await this.tutorService.isProfileComplete(
      user.idUser,
    );

    return {
      userId: user.idUser,
      name: user.name,
      email: user.email,
      hasTemporaryPassword,
      profileCompleted,
      requiresPasswordChange: hasTemporaryPassword,
      requiresProfileCompletion: !profileCompleted,
    };
  }

  // =====================================================
  // POST /api/v1/tutors/:tutorId/subjects
  // RF-13: Asignar materias al tutor (solo TUTOR autenticado)
  // =====================================================
  @Post(':tutorId/subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async assignSubjects(
    @Param('tutorId') tutorId: string,
    @CurrentUser() user: User,
    @Body() dto: AssignSubjectsDto,
  ) {
    if (user.role === UserRole.TUTOR && user.idUser !== tutorId) {
      throw new ForbiddenException('Cannot assign subjects to another tutor');
    }

    return this.subjectsService.assignSubjectsToTutor(tutorId, dto.subjects_ids);
  }
}