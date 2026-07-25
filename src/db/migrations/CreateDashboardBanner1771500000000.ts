import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDashboardBanner1771500000000 implements MigrationInterface {
  name = 'CreateDashboardBanner1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dashboard_banner" (
        "id" SMALLINT PRIMARY KEY DEFAULT 1,
        "image_url" TEXT NOT NULL,
        "target_url" TEXT NOT NULL,
        "updated_by" UUID NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),

        -- Garantiza a nivel de BD que solo puede existir una fila:
        -- cualquier intento de insertar id != 1 falla, y solo puede
        -- haber un registro con id = 1 por ser PRIMARY KEY.
        CONSTRAINT "chk_dashboard_banner_single_row" CHECK ("id" = 1),

        CONSTRAINT "fk_dashboard_banner_updated_by"
          FOREIGN KEY ("updated_by")
          REFERENCES "users"("id_user")
          ON DELETE RESTRICT
          ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "dashboard_banner" IS
        'Banner publicitario único mostrado en el dashboard de todos los usuarios. Solo existe una fila (id=1), gestionada exclusivamente por ADMIN.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dashboard_banner"`);
  }
}
