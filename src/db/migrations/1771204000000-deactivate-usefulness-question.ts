import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeactivateUsefulnessQuestion1771204000000 implements MigrationInterface {
  name = 'DeactivateUsefulnessQuestion1771204000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "questions" SET "is_active" = false WHERE "aspect" = 'USEFULNESS' AND "questionnaire_version" = '1.0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "questions" SET "is_active" = true WHERE "aspect" = 'USEFULNESS' AND "questionnaire_version" = '1.0'`,
    );
  }
}
