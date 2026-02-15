import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSubjectTimestamps1771187766530 implements MigrationInterface {
    name = 'RemoveSubjectTimestamps1771187766530'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tutors" ALTER COLUMN "isActive" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tutors" ALTER COLUMN "isActive" SET DEFAULT true`);
    }

}
