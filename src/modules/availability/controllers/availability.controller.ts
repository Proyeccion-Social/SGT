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
    ) { }

    @Get('subjects/:subjectId/tutors')
    @UseGuards(JwtAuthGuard)
    async getTutorsBySubject(
        @Param('subjectId') subjectId: string,
        @Query() filters: FilterTutorsDto,
    ) {
        //====================================================
        // GET /api/v1/availability/subjects/:subjectId/tutors
        // RF-14: Visualizar tutores por materia (Código o Nombre)
        //====================================================

        let subject;

        // 2. Obtener tutores usando el TutorService (que soporta Nombre parcial)
        const tutors = await this.tutorService.findTutorsBySubject(subjectId);

        return {
            success: true,
            subject: subject ? {
                id: subject.idSubject,
                name: subject.name,

            } : { name: subjectId }, // Si buscamos por nombre, devolver el término
            data: tutors,
            total: tutors.length,
        };
    }
}
