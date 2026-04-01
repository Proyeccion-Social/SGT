import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationIdToAnswers1771203000000 implements MigrationInterface {
  name = 'AddEvaluationIdToAnswers1771203000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "answers" ADD COLUMN "evaluation_id" uuid`,
    );

    await queryRunner.query(
      `UPDATE "answers" SET "evaluation_id" = (
        substring(md5("id_session"::text || ':' || "id_student"::text), 1, 8) || '-' ||
        substring(md5("id_session"::text || ':' || "id_student"::text), 9, 4) || '-' ||
        substring(md5("id_session"::text || ':' || "id_student"::text), 13, 4) || '-' ||
        substring(md5("id_session"::text || ':' || "id_student"::text), 17, 4) || '-' ||
        substring(md5("id_session"::text || ':' || "id_student"::text), 21, 12)
      )::uuid WHERE "evaluation_id" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "answers" ALTER COLUMN "evaluation_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_answers_evaluation_id" ON "answers" ("evaluation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_answers_evaluation_id"`);
    await queryRunner.query(
      `ALTER TABLE "answers" DROP COLUMN "evaluation_id"`,
    );
  }
}
