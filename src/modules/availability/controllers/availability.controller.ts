import { Controller, Get, UseGuards, Param, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotFoundException } from '@nestjs/common';
import { FilterTutorsDto } from '../dto/filter-tutors.dto';
import { SubjectsService } from 'src/modules/subjects/services/subjects.service';
import { TutorService } from 'src/modules/tutor/services/tutor.service';

@Controller('availability')
export class AvailabilityController {

    constructor(
        private readonly subjectsService: SubjectsService,
        private readonly tutorService: TutorService,
    ) {}
    
    @Get('subjects/:subjectId/tutors')
    @UseGuards(JwtAuthGuard)
    async getTutorsBySubject(
    @Param('subjectId') subjectId: string,
    @Query() filters: FilterTutorsDto,
    ) {
    //====================================================
    // GET /api/v1/availability/subjects/:subjectId/tutors
    // RF-14: Visualizar tutores por materia
    //====================================================
    
    // 1. Validar que la materia exista
    const subject = await this.subjectsService.findById(subjectId);
    if (!subject) {
        throw new NotFoundException('RESOURCE_02: Subject not found');
    }

    // 2. Obtener tutores que imparten la materia
    const tutorIds = await this.subjectsService.getTutorsBySubject(subjectId);

    return {
        success: true,
        subject: {
        id: subject.idSubject,
        name: subject.name,
        code: subject.code,
        },
        data: tutorIds,
        total: tutorIds.length,
    };
    }
}
