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
} from '@nestjs/common';
import { TutorService } from '../services/tutor.service';
import { CompleteTutorProfileDto } from '../dto/complete-tutor-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('tutors')
export class TutorsController {
  constructor(private tutorService: TutorService) {}

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
    const hasTemporaryPassword = await this.tutorService.hasTemporaryPassword(
      user.idUser,
    );
    const profileCompleted = await this.tutorService.isProfileCompleted(
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
}