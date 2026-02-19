/*import { AppDataSource } from "../db/data-source";
import { SubjectsSeeder } from "./subjects.seeder";
import { Logger } from "@nestjs/common";

const logger = new Logger("Seeders");

async function runSeeders() {
    try {
        logger.log("Starting seeders");
        await AppDataSource.initialize();
        logger.log("Database connected");

        const subjectsSeeder = new SubjectsSeeder();
        await subjectsSeeder.run(AppDataSource);
        logger.log("Subjects seeded successfully");

        await AppDataSource.destroy();
        logger.log("Database disconnected");
    } catch (error) {
        logger.error('Error running seeders', error);
        process.exit(1);
    }
}

runSeeders();
*/