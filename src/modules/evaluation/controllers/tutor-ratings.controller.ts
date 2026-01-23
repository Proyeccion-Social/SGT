import { Controller } from '@nestjs/common';

@Controller('tutor-ratings')
export class TutorRatingsController {}

/*
Responsabilidad:
Consultar resultados agregados (lectura).

Ejemplos de endpoints:

GET /api/v1/session-execution/tutors/{tutorId}/evaluations
GET /api/v1/session-execution/tutors/{tutorId}/stats

No registra nada, solo consulta y calcula.
*/