import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendEvaluationModel1771201000000 implements MigrationInterface {
  name = 'ExtendEvaluationModel1771201000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "aspect" character varying(30) NOT NULL DEFAULT 'CLARITY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "label" character varying(150) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "required" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "display_order" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "min_score" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "max_score" smallint NOT NULL DEFAULT 5`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "questionnaire_version" character varying(20) NOT NULL DEFAULT '1.0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "questions" SET "label" = "content" WHERE "label" = ''`,
    );

    await queryRunner.query(
      `ALTER TABLE "answers" ADD COLUMN "evaluated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD COLUMN "questionnaire_version" character varying(20) NOT NULL DEFAULT '1.0'`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_questions_version_order" ON "questions" ("questionnaire_version", "display_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_answers_session_student" ON "answers" ("id_session", "id_student")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_answers_session_student"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_questions_version_order"`,
    );

    await queryRunner.query(
      `ALTER TABLE "answers" DROP COLUMN "questionnaire_version"`,
    );
    await queryRunner.query(`ALTER TABLE "answers" DROP COLUMN "evaluated_at"`);

    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "is_active"`);
    await queryRunner.query(
      `ALTER TABLE "questions" DROP COLUMN "questionnaire_version"`,
    );
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "max_score"`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "min_score"`);
    await queryRunner.query(
      `ALTER TABLE "questions" DROP COLUMN "display_order"`,
    );
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "required"`);
    await queryRunner.query(
      `ALTER TABLE "questions" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "label"`);
    await queryRunner.query(`ALTER TABLE "questions" DROP COLUMN "aspect"`);
  }
}
