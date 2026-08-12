import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { TutorService } from '../modules/tutor/services/tutor.service';
import { UserService } from '../modules/users/services/users.service';
import { UserRole } from '../modules/users/entities/user.entity';
import { readFile } from 'fs/promises';

interface TutorSeedItem {
  name: string;
  email: string;
}

const logger = new Logger('RegisterTutorsSeeder');

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveEnvironment(): 'development' | 'production' | 'test' {
  const env = getArgValue('--env') || process.env.NODE_ENV || 'development';

  if (env !== 'development' && env !== 'production' && env !== 'test') {
    throw new Error(`Invalid environment: ${env}`);
  }

  return env;
}

async function bootstrap() {
  const env = resolveEnvironment();
  process.env.NODE_ENV = env;

  const adminIdArg = getArgValue('--adminId');
  const adminEmailArg = getArgValue('--adminEmail');
  const filePath = getArgValue('--file');

  if (env === 'production' && !process.env.NEON_DATABASE_URL) {
    logger.error(
      'NEON_DATABASE_URL is required when running in production mode',
    );
    process.exit(1);
  }

  if ((!adminIdArg && !adminEmailArg) || !filePath) {
    logger.error(
      'Usage: ts-node src/seeders/register-tutors.ts --env <development|production> --adminId <uuid> | --adminEmail <email> --file <path-to-json>',
    );
    process.exit(1);
  }

  const tutors = JSON.parse(
    await readFile(filePath, 'utf8'),
  ) as TutorSeedItem[];

  if (!Array.isArray(tutors) || tutors.length === 0) {
    logger.warn('No tutors found in input file');
    process.exit(0);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const userService = app.get(UserService);
    const tutorService = app.get(TutorService);

    let adminId = adminIdArg;

    if (!adminId && adminEmailArg) {
      const admin = await userService.findByEmail(adminEmailArg);

      if (!admin) {
        throw new Error(`Admin not found for email ${adminEmailArg}`);
      }

      if (admin.role !== UserRole.ADMIN) {
        throw new Error(`User ${adminEmailArg} is not an ADMIN`);
      }

      adminId = admin.idUser;
    }

    if (!adminId) {
      throw new Error('Unable to resolve admin identity');
    }

    const admin = await userService.findById(adminId);

    if (!admin) {
      throw new Error(`Admin not found for id ${adminId}`);
    }

    if (admin.role !== UserRole.ADMIN) {
      throw new Error(
        `User ${admin.idUser} (${admin.email}) is not an ADMIN in the target database`,
      );
    }

    for (const tutor of tutors) {
      const alreadyExists = await userService.existsByEmail(tutor.email);

      if (alreadyExists) {
        logger.warn(`Skipping existing tutor: ${tutor.email}`);
        continue;
      }

      logger.log(`Creating tutor: ${tutor.name} <${tutor.email}>`);
      const result = await tutorService.createByAdmin(adminId, {
        name: tutor.name,
        email: tutor.email,
      });
      logger.log(`Created tutor ${result.tutor.id}: ${result.tutor.email}`);
    }

    logger.log(`Finished registering ${tutors.length} tutor(s)`);
  } catch (error) {
    logger.error(
      'Error registering tutors',
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  } finally {
    try {
      await app.close();
    } catch (shutdownError) {
      logger.warn(
        `Application shutdown completed with a non-fatal issue: ${shutdownError instanceof Error ? shutdownError.message : String(shutdownError)}`,
      );
    }
  }
}

void bootstrap();
