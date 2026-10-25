import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWithdrawnEnums1771600000000 implements MigrationInterface {
  name = 'AddWithdrawnEnums1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nuevo valor en sessions.status para el retiro de solicitud pendiente
    await queryRunner.query(`
      ALTER TYPE "sessions_status_enum"
        ADD VALUE IF NOT EXISTS 'WITHDRAWN_BY_STUDENT'
    `);

    // Nuevo tipo de notificación interna para el retiro
    await queryRunner.query(`
      ALTER TYPE "app_notifications_type_enum"
        ADD VALUE IF NOT EXISTS 'SESSION_REQUEST_WITHDRAWN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no soporta DROP VALUE de un enum directamente.
    // Se recrea el tipo sin los valores nuevos y se reasigna la columna.

    // ── 1. sessions.status ──────────────────────────────────────────────
    // Si hay registros con WITHDRAWN_BY_STUDENT, se homologan a CANCELLED_BY_STUDENT
    // para que no rompa la recreación del enum sin ese valor.
    await queryRunner.query(`
      UPDATE "sessions"
        SET "status" = 'CANCELLED_BY_STUDENT'
        WHERE "status"::text = 'WITHDRAWN_BY_STUDENT'
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ALTER COLUMN "status" TYPE VARCHAR
    `);

    await queryRunner.query(`DROP TYPE "sessions_status_enum"`);

    await queryRunner.query(`
      CREATE TYPE "sessions_status_enum" AS ENUM (
        'PENDING_TUTOR_CONFIRMATION',
        'SCHEDULED',
        'PENDING_MODIFICATION',
        'REJECTED_BY_TUTOR',
        'CANCELLED_BY_STUDENT',
        'CANCELLED_BY_TUTOR',
        'CANCELLED_BY_ADMIN',
        'COMPLETED',
        'EXPIRED_UNCONFIRMED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ALTER COLUMN "status" TYPE "sessions_status_enum"
        USING "status"::"sessions_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
        ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'
    `);

    // ── 2. app_notifications.type ───────────────────────────────────────
    await queryRunner.query(`
      DELETE FROM "app_notifications"
        WHERE "type"::text = 'SESSION_REQUEST_WITHDRAWN'
    `);

    await queryRunner.query(`
      ALTER TABLE "app_notifications"
        ALTER COLUMN "type" TYPE VARCHAR
    `);

    await queryRunner.query(`DROP TYPE "app_notifications_type_enum"`);

    await queryRunner.query(`
      CREATE TYPE "app_notifications_type_enum" AS ENUM (
        'SESSION_REQUEST_RECEIVED',
        'SESSION_REQUEST_ACK',
        'SESSION_CONFIRMED',
        'SESSION_REJECTED',
        'SESSION_CANCELLED',
        'MODIFICATION_REQUEST',
        'MODIFICATION_ACCEPTED',
        'MODIFICATION_REJECTED',
        'SESSION_DETAILS_UPDATED',
        'SESSION_REMINDER_24H',
        'SESSION_REMINDER_2H',
        'EVALUATION_PENDING',
        'EVALUATION_REMINDER',
        'AVAILABILITY_CHANGED',
        'HOUR_LIMIT_ALERT',
        'SESSION_ABSENT'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "app_notifications"
        ALTER COLUMN "type" TYPE "app_notifications_type_enum"
        USING "type"::"app_notifications_type_enum"
    `);
  }
}
