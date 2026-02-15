import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.LOCAL_DB_HOST,
    port: parseInt(process.env.LOCAL_DB_PORT!),
    username: process.env.LOCAL_DB_USER,
    password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME,

    synchronize: false,
    logging: process.env.NODE_ENV === 'development',

    entities: ['src/**/entities/*.entity.{ts,js}'],
    migrations: ['src/migrations/*.ts'],
});
