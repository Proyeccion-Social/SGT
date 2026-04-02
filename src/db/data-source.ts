import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.LOCAL_DB_HOST,
    port: parseInt(process.env.LOCAL_DB_PORT!),
    username: process.env.LOCAL_DB_USER,
    password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME,

    synchronize: true,
    logging: process.env.NODE_ENV === 'development',

    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../migrations/*.ts')],
});