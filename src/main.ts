import * as moduleAlias from 'module-alias';
import { NestFactory } from '@nestjs/core';

// Ensure absolute imports like "src/..." resolve in serverless runtime.
moduleAlias.addAlias('src', __dirname);
const { AppModule } = require('./app.module');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Prefijo global para todos los endpoints
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
