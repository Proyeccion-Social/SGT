import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { StudentService } from '../services/student.service';
import {
  UpdateStudentPreferencesDto,
  UpdateInterestedSubjectsDto,
} from '../dto/update-student-preferences.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentService: StudentService) {}

  // =====================================================
  // GET /api/v1/students/me/preferences
  // Obtener preferencias del estudiante autenticado
  // =====================================================
  @Get('me/preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async getPreferences(@CurrentUser() user: User) {
    return this.studentService.getPreferences(user.idUser);
  }

  // =====================================================
  // PATCH /api/v1/students/me/preferences
  // Actualizar preferencias del estudiante autenticado
  // =====================================================
  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateStudentPreferencesDto,
  ) {
    return this.studentService.updatePreferences(user.idUser, dto);
  }

  // =====================================================
  // GET /api/v1/students/me/interested-subjects
  // Obtener materias de interés del estudiante autenticado
  // =====================================================
  @Get('me/interested-subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async getInterestedSubjects(@CurrentUser() user: User) {
    return this.studentService.getInterestedSubjects(user.idUser);
  }

  // =====================================================
  // PATCH /api/v1/students/me/interested-subjects
  // Actualizar materias de interés del estudiante autenticado
  // =====================================================
  @Patch('me/interested-subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async updateInterestedSubjects(
    @CurrentUser() user: User,
    @Body() dto: UpdateInterestedSubjectsDto,
  ) {
    return this.studentService.updateInterestedSubjects(user.idUser, dto);
  }

  // =====================================================
  // GET /api/v1/students/:studentId/preferences
  // Obtener preferencias de un estudiante (solo ADMIN/TUTOR)
  // =====================================================
  @Get(':studentId/preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async getPreferencesById(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.studentService.getPreferencesById(studentId);
  }

  // =====================================================
  // GET /api/v1/students/:studentId/interested-subjects
  // Obtener materias de interés de un estudiante (solo ADMIN/TUTOR)
  // =====================================================
  @Get(':studentId/interested-subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TUTOR)
  @HttpCode(HttpStatus.OK)
  async getInterestedSubjectsById(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.studentService.getInterestedSubjectsById(studentId);
  }
}
