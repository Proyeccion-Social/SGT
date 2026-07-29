import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModalityArrayToTutorAvailability1771300000000 implements MigrationInterface {
  name = 'AddModalityArrayToTutorAvailability1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "tutor_have_availability_modality_enum" AS ENUM ('PRES', 'VIRT')`,
    );

    await queryRunner.query(
      `ALTER TABLE "tutor_have_availability"
       ALTER COLUMN "modality"
       TYPE "tutor_have_availability_modality_enum"[]
       USING CASE
         WHEN "modality" IS NULL THEN NULL
         ELSE ARRAY["modality"]::text[]
       END::"tutor_have_availability_modality_enum"[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tutor_have_availability"
       ALTER COLUMN "modality"
       TYPE varchar(10)
       USING CASE
         WHEN "modality" IS NULL THEN NULL
         WHEN array_length("modality", 1) IS NULL THEN NULL
         ELSE "modality"[1]::text
       END`,
    );

    await queryRunner.query(
      `DROP TYPE "tutor_have_availability_modality_enum"`,
    );
  }
}
