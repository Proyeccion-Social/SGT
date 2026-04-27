import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { SubjectsService } from '../services/subjects.service';
import { SubjectFilterDto } from '../dto/subject-filter.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UsePipes, ValidationPipe } from '@nestjs/common';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TUTOR, UserRole.ADMIN, UserRole.STUDENT)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  // =====================================================
  // GET /api/v1/subjects
  // Listar todas las materias (para selección en UI)
  // =====================================================

  @Get()
  async findAll(@Query() filters: SubjectFilterDto) {
    return {
      success: true,
      ...(await this.subjectsService.findAll(filters.page, filters.limit)),
    };
  }

  // =====================================================
  // GET /api/v1/subjects/:id
  // Obtener una materia específica
  // =====================================================
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const subject = await this.subjectsService.findById(id);

    if (!subject) {
      throw new NotFoundException(`Subject with id ${id} not found`);
    }

    return {
      success: true,
      data: {
        id: subject.idSubject,
        name: subject.name,
        color: subject.color,
        borderColor: subject.borderColor,
      },
    };
  }

  // =====================================================
  // GET /api/v1/subjects/:id/tutors
  // RF-14: Visualizar tutores por materia
  // =====================================================
  @Get(':id/tutors')
  async getTutorsBySubject(@Param('id') subjectId: string) {
    // Validar que la materia exista
    const exists = await this.subjectsService.exists(subjectId);
    if (!exists) {
      throw new NotFoundException(`Subject with id ${subjectId} not found`);
    }

    const tutorIds = await this.subjectsService.getTutorsBySubject(subjectId);

    // TODO: Obtener información completa de tutores desde TutorService
    // Por ahora solo retornar IDs

    return {
      success: true,
      subjectId,
      data: tutorIds,
      total: tutorIds.length,
    };
  }
}
