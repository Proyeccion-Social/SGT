import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TutorService } from '../services/tutor.service';
import { UserService } from '../../users/services/users.service';
import { CompleteTutorProfileDto } from '../dto/complete-tutor-profile.dto';
import { CreateTutorDto } from '../dto/create-tutor.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { UpdateTutorProfileDto } from '../dto/update-tutor-profile.dto';

@Controller('tutors')
export class TutorsController {
  constructor(
    private readonly tutorService: TutorService,
    private readonly userService: UserService,
  ) {}

  // =====================================================
  // POST /api/v1/tutors
  // RF08: Crear tutor (solo ADMIN)
  // =====================================================
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createTutor(@CurrentUser() admin: User, @Body() dto: CreateTutorDto) {
    return this.tutorService.createByAdmin(admin.idUser, dto);
  }

  // =====================================================
  // POST /api/v1/tutors/profile/complete
  // RF09: Completar perfil de tutor
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
  // PATCH /api/v1/tutors/profile/update
  // RF10: actualizar perfil de tutor
  // =====================================================
  @Patch('profile/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateTutorProfileDto,
  ) {
    return this.tutorService.updateProfile(user.idUser, dto);
  }

  // =====================================================
  // GET /api/v1/tutors/me/status
  // Estado del perfil del tutor autenticado
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
  // PATCH /api/v1/tutors/:id/active
  // Activar / desactivar tutor (ADMIN)
  // =====================================================
  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async setTutorActive(
    @Param('id') tutorId: string,
    @Body('isActive') isActive: boolean,
  ) {
    await this.tutorService.setActive(tutorId, isActive);
    return { message: 'Tutor status updated successfully' };
  }

  // =====================================================
  // PATCH /api/v1/tutors/me/active
  // Activar / desactivar tutor (ADMIN)
  // =====================================================
  @Patch('me/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async setMyAccountActive(
    @CurrentUser() user: User,
    @Body('isActive') isActive: boolean,
  ) {
    await this.tutorService.setActive(user.idUser, isActive);
    return { message: 'Tutor status updated successfully' };
  }

  // =====================================================
  // GET /api/v1/tutors/profile
  // VER PERFIL PROPIO (TUTOR)
  // =====================================================
  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  async getMyProfile(@CurrentUser() user: User) {
    return this.tutorService.getOwnProfile(user.idUser);
  }

  // =====================================================
  // GET /api/v1/tutors/:id/hours-status
  // Estado de horas semanales del tutor (TUTOR propio o ADMIN)
  // =====================================================
  @Get(':id/hours-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR, UserRole.ADMIN)
  async getTutorHoursStatus(
    @CurrentUser() user: User,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException({
            errorCode: 'VALIDATION_01',
            message: 'ID de tutor inválido',
          }),
      }),
    )
    tutorId: string,
  ) {
    if (user.role === UserRole.TUTOR && user.idUser !== tutorId) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Solo puedes consultar tus propias horas',
      });
    }

    return this.tutorService.getTutorHoursStatus(tutorId);
  }

  // =====================================================
  // GET /api/v1/tutors/:id
  // RF11: Perfil público de tutor
  // =====================================================
  @Public()
  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.tutorService.getPublicProfile(id);
  }
}
