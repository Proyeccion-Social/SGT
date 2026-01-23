import { Controller } from '@nestjs/common';

@Controller('evaluation')
export class EvaluationController {}

/*Responsabilidad:
Registrar evaluaciones (escritura).

Ejemplos de endpoints:

POST /api/v1/session-execution/sessions/{sessionId}/evaluation
GET  /api/v1/session-execution/sessions/{sessionId}/evaluation

Conceptualmente:

un estudiante evalúa una sesión

se registran respuestas

se valida que participó
*/