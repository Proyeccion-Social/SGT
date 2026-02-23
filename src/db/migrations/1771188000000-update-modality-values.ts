import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateModalityValues1771188000000 implements MigrationInterface {
    name = 'UpdateModalityValues1771188000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Actualizar valores existentes de PRES a PRESENCIAL y VIRT a VIRTUAL
        await queryRunner.query(`
            UPDATE tutor_have_availability 
            SET modality = 'PRESENCIAL' 
            WHERE modality = 'PRES'
        `);
        
        await queryRunner.query(`
            UPDATE tutor_have_availability 
            SET modality = 'VIRTUAL' 
            WHERE modality = 'VIRT'
        `);

        // Actualizar el CHECK constraint si existe
        await queryRunner.query(`
            ALTER TABLE tutor_have_availability 
            DROP CONSTRAINT IF EXISTS "CHK_tutor_have_availability_modality"
        `);

        await queryRunner.query(`
            ALTER TABLE tutor_have_availability 
            ADD CONSTRAINT "CHK_tutor_have_availability_modality" 
            CHECK (modality IN ('PRESENCIAL', 'VIRTUAL'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revertir valores de PRESENCIAL a PRES y VIRTUAL a VIRT
        await queryRunner.query(`
            UPDATE tutor_have_availability 
            SET modality = 'PRES' 
            WHERE modality = 'PRESENCIAL'
        `);
        
        await queryRunner.query(`
            UPDATE tutor_have_availability 
            SET modality = 'VIRT' 
            WHERE modality = 'VIRTUAL'
        `);

        // Revertir el CHECK constraint
        await queryRunner.query(`
            ALTER TABLE tutor_have_availability 
            DROP CONSTRAINT IF EXISTS "CHK_tutor_have_availability_modality"
        `);

        await queryRunner.query(`
            ALTER TABLE tutor_have_availability 
            ADD CONSTRAINT "CHK_tutor_have_availability_modality" 
            CHECK (modality IN ('PRES', 'VIRT'))
        `);
    }
}
