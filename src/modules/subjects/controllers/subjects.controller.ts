import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SubjectsService } from '../services/subjects.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('subjects')
export class SubjectsController {
    constructor(private readonly subjectsService: SubjectsService) { }

    // =====================================================
    // GET /api/v1/subjects
    // Listar todas las materias (para selección en UI)
    // =====================================================
    @Public()
    @Get()
    async findAll() {
        const subjects = await this.subjectsService.findAll();

        return {
            success: true,
            data: subjects.map(s => ({
                id: s.idSubject,
                name: s.name,

            })),
            total: subjects.length,
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


