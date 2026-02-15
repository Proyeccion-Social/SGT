import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSubjectCode1771187324485 implements MigrationInterface {
    name = 'RemoveSubjectCode1771187324485'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subjects" DROP CONSTRAINT "UQ_542cbba74dde3c82ab49c573109"`);
        await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN "code"`);
        await queryRunner.query(`ALTER TABLE "tutors" ALTER COLUMN "isActive" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tutors" ALTER COLUMN "isActive" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD "code" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "subjects" ADD CONSTRAINT "UQ_542cbba74dde3c82ab49c573109" UNIQUE ("code")`);
    }

}
