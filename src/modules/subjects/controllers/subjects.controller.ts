import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { SubjectsService } from '../services/subjects.service';
import { Public } from '../../auth/decorators/public.decorator';
import { SubjectFilterDto } from '../dto/subject-filter.dto';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  // =====================================================
  // GET /api/v1/subjects
  // Listar todas las materias (para selección en UI)
  // =====================================================
  @Public()
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
  @Public()
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
      },
    };
  }

  // =====================================================
  // GET /api/v1/subjects/:id/tutors
  // RF-14: Visualizar tutores por materia
  // =====================================================
  @Public()
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
