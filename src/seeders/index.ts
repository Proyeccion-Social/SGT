import { AppDataSource } from '../db/data-source';
import { SubjectsSeeder } from './subjects.seeder';
import { UsersSeeder } from './users.seeder';
import { SubjectRelationsSeeder } from './subject-relations.seeder';
import { AvailabilitySeeder } from './availability.seeder';
import { AuthSeeder } from './auth.seeder';
import { SessionsSeeder } from './sessions.seeder';
import { EvaluationSeeder } from './evaluation.seeder';
import { Logger } from '@nestjs/common';

const logger = new Logger('Seeders');

async function runSeeders() {
  try {
    logger.log('Starting seeders...');
    await AppDataSource.initialize();
    logger.log('Database connected');

    // 1. Materias base (independiente)
    await new SubjectsSeeder().run(AppDataSource);

    // 2. Usuarios: admin, tutores, estudiantes (con perfiles)
    await new UsersSeeder().run(AppDataSource);

    // 3. Relaciones materia-tutor y materia-estudiante
    await new SubjectRelationsSeeder().run(AppDataSource);

    // 4. Disponibilidad horaria y asignación a tutores
    await new AvailabilitySeeder().run(AppDataSource);

    // 5. Auth: sesiones, tokens, audit_logs
    await new AuthSeeder().run(AppDataSource);

    // 6. Sesiones de tutoría (completas, programadas, futuras) + scheduled + modification_requests
    await new SessionsSeeder().run(AppDataSource);

    // 7. Evaluación: preguntas, participaciones, respuestas
    await new EvaluationSeeder().run(AppDataSource);

    await AppDataSource.destroy();
    logger.log('All seeders completed. Database disconnected.');
  } catch (error) {
    logger.error('Error running seeders', error);
    process.exit(1);
  }
}

runSeeders();