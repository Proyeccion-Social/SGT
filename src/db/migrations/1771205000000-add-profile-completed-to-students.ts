import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfileCompletedToStudents1771205000000 implements MigrationInterface {
  name = 'AddProfileCompletedToStudents1771205000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'students',
      new TableColumn({
        name: 'profile_completed',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Update existing records where both career and preferred_modality are set
    await queryRunner.query(
      `UPDATE "students" SET "profile_completed" = true WHERE "career" IS NOT NULL AND "preferred_modality" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('students', 'profile_completed');
  }
}
