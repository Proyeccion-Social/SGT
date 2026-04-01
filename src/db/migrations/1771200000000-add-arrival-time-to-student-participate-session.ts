import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArrivalTimeToStudentParticipateSession1771200000000
  implements MigrationInterface
{
  name = 'AddArrivalTimeToStudentParticipateSession1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "student_participate_session" ADD COLUMN "arrival_time" TIMESTAMP',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "student_participate_session" DROP COLUMN "arrival_time"',
    );
  }
}
