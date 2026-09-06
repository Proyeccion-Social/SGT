// src/db/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Detecta si se está ejecutando el código ya compilado (dist/) o
// directamente en TypeScript vía ts-node (desarrollo local).
// __dirname apunta a la carpeta donde vive ESTE archivo en tiempo de
// ejecución: será .../dist/db en producción, o .../src/db en desarrollo.
const isCompiled = __dirname.includes('dist');
const rootDir = isCompiled
  ? path.join(__dirname, '..') // dist/db → dist/
  : path.join(__dirname, '..'); // src/db  → src/
const ext = isCompiled ? 'js' : 'ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.LOCAL_DB_HOST,
  port: parseInt(process.env.LOCAL_DB_PORT!),
  username: process.env.LOCAL_DB_USER,
  password: process.env.LOCAL_DB_PASSWORD,
  database: process.env.LOCAL_DB_NAME,

  synchronize: false,
  logging: process.env.NODE_ENV === 'development',

  // Antes: 'src/**/*.entity.{ts,js}' — ruta fija, solo funcionaba
  // ejecutando desde la raíz del proyecto con src/ presente.
  // Ahora: relativa a la ubicación real de este archivo compilado o no,
  // funciona igual en desarrollo (ts-node) y en el contenedor (dist/).
  entities: [`${rootDir}/**/*.entity.${ext}`],
  migrations: [`${rootDir}/db/migrations/*.${ext}`],
});
