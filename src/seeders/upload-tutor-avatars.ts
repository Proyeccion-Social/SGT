import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFile, readdir } from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from '../app.module';
import { CloudinaryService } from '../modules/cloudinary/services/cloudinary.service';
import { TutorService } from '../modules/tutor/services/tutor.service';
import { UserService } from '../modules/users/services/users.service';
import { UserRole } from '../modules/users/entities/user.entity';

interface TutorSeedItem {
  name: string;
  email: string;
}

interface TutorAvatarResult {
  email: string;
  fileName: string;
  secureUrl: string;
  publicId: string;
}

const logger = new Logger('UploadTutorAvatarsSeeder');
const DEFAULT_IMAGES_DIR = 'C:\\Users\\birdo\\OneDrive\\Escritorio\\imagenes';

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

function normalizeEmailStem(email: string): string {
  return email.trim().toLowerCase();
}

async function findTutorImage(
  imagesDir: string,
  email: string,
): Promise<string | null> {
  const stem = normalizeEmailStem(email);
  const entries = await readdir(imagesDir, { withFileTypes: true });

  const imageEntry = entries.find((entry) => {
    if (!entry.isFile()) return false;
    const lower = entry.name.toLowerCase();
    const base = lower.replace(/\.[^.]+$/, '');
    return base === stem && /\.(jpg|jpeg|png|webp)$/.test(lower);
  });

  if (!imageEntry) {
    return null;
  }

  return path.join(imagesDir, imageEntry.name);
}

async function uploadToCloudinary(
  cloudinaryService: CloudinaryService,
  imagePath: string,
  folder: string,
  publicId: string,
): Promise<{ secure_url: string; public_id: string }> {
  const signaturePayload = cloudinaryService.generateUploadSignature(
    folder,
    publicId,
  );
  const imageBuffer = await readFile(imagePath);
  const fileName = path.basename(imagePath);
  const extension = path.extname(fileName).replace('.', '').toLowerCase();
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([imageBuffer], { type: mimeType }),
    fileName,
  );
  formData.append('api_key', signaturePayload.api_key);
  formData.append('timestamp', signaturePayload.timestamp);
  formData.append('signature', signaturePayload.signature);
  formData.append('folder', signaturePayload.folder);
  formData.append('public_id', signaturePayload.public_id);

  const endpoint = `https://api.cloudinary.com/v1_1/${signaturePayload.cloud_name}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Cloudinary upload failed for ${fileName}: ${response.status} ${response.statusText} - ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    secure_url: string;
    public_id: string;
  };

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
  };
}

async function bootstrap() {
  const env = resolveEnvironment();
  process.env.NODE_ENV = env;

  const tutorsFile =
    getArgValue('--file') || 'src/seeders/tutors.production.json';
  const imagesDir = getArgValue('--imagesDir') || DEFAULT_IMAGES_DIR;
  const adminEmailArg = getArgValue('--adminEmail');
  const adminIdArg = getArgValue('--adminId');

  if (env === 'production' && !process.env.NEON_DATABASE_URL) {
    logger.error(
      'NEON_DATABASE_URL is required when running in production mode',
    );
    process.exit(1);
  }

  if (!adminEmailArg && !adminIdArg) {
    logger.warn(
      'No admin provided. The script will validate tutors directly in the target database.',
    );
  }

  const tutors = JSON.parse(
    await readFile(tutorsFile, 'utf8'),
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
    const cloudinaryService = app.get(CloudinaryService);

    if (adminEmailArg || adminIdArg) {
      const admin = adminIdArg
        ? await userService.findById(adminIdArg)
        : await userService.findByEmail(adminEmailArg as string);

      if (!admin) {
        throw new Error('Admin not found in the target database');
      }

      if (admin.role !== UserRole.ADMIN) {
        throw new Error(
          `User ${admin.email} is not an ADMIN in the target database`,
        );
      }
    }

    const results: TutorAvatarResult[] = [];

    for (const tutor of tutors) {
      const tutorRecord = await userService.findByEmail(tutor.email);

      if (!tutorRecord) {
        logger.warn(
          `Tutor not found in DB, skipping avatar upload: ${tutor.email}`,
        );
        continue;
      }

      const imagePath = await findTutorImage(imagesDir, tutor.email);

      if (!imagePath) {
        logger.warn(`Image not found for ${tutor.email} in ${imagesDir}`);
        continue;
      }

      const folder = `tutors/${tutorRecord.idUser}`;
      const publicId = 'avatar';

      logger.log(`Uploading avatar for ${tutor.email} from ${imagePath}`);
      const uploaded = await uploadToCloudinary(
        cloudinaryService,
        imagePath,
        folder,
        publicId,
      );

      try {
        await tutorService.confirmAvatarUpload(
          tutorRecord.idUser,
          uploaded.secure_url,
          uploaded.public_id,
        );
      } catch (error) {
        logger.warn(
          `Cloudinary upload completed but tutor profile could not be updated for ${tutor.email}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      results.push({
        email: tutor.email,
        fileName: path.basename(imagePath),
        secureUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
      });

      logger.log(`Updated avatar URL for ${tutor.email}`);
    }

    logger.log(`Finished processing ${results.length} tutor avatar(s)`);
    for (const result of results) {
      logger.log(`${result.email} -> ${result.secureUrl}`);
    }
  } catch (error) {
    logger.error(
      'Error uploading tutor avatars',
      error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
  } finally {
    try {
      const dataSource = app.get<DataSource>(getDataSourceToken('local'));
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    } catch (shutdownError) {
      logger.warn(
        `Application shutdown completed with a non-fatal issue: ${shutdownError instanceof Error ? shutdownError.message : String(shutdownError)}`,
      );
    }
  }
}

void bootstrap();
