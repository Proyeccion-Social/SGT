import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupSessionSupport1771400000000
  implements MigrationInterface
{
  name = 'AddGroupSessionSupport1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Capacidad máxima de una sesión grupal. Solo tiene sentido cuando
    // type = GROUP; para INDIVIDUAL permanece NULL.
    await queryRunner.query(`
      ALTER TABLE "sessions"
        ADD COLUMN IF NOT EXISTS "max_participants" SMALLINT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ADD CONSTRAINT "chk_sessions_max_participants"
        CHECK (
          "max_participants" IS NULL
          OR ("max_participants" BETWEEN 1 AND 30)
        )
    `);

    // Marca de tiempo de cuándo un estudiante se unió a la sesión.
    // Útil para ordenar/mostrar en UI quién llegó primero; no otorga
    // privilegios especiales (cualquier participante puede abandonar,
    // solo el tutor puede cancelar la sesión completa).
    await queryRunner.query(`
      ALTER TABLE "student_participate_session"
        ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP NOT NULL DEFAULT NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_participate_session"
        DROP COLUMN IF EXISTS "joined_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        DROP CONSTRAINT IF EXISTS "chk_sessions_max_participants"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        DROP COLUMN IF EXISTS "max_participants"
    `);
  }
}