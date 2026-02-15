import { DataSource } from "typeorm";
import { Subject } from "../modules/subjects/entities/subjects.entity";
import { Logger } from "@nestjs/common";

export class SubjectsSeeder {
    private readonly logger = new Logger(SubjectsSeeder.name);
    public async run(dataSource: DataSource): Promise<void> {
        const subjectRepository = dataSource.getRepository(Subject);

        const subjects = [
            //Matemáticas
            { name: "Cálculo Diferencial", code: 25941},
            { name: "Cálculo Integral", code: 7},
            { name: "Ecuaciones Diferenciales", code: 88},
            { name: "Matemáticas Discretas", code: 26130},
            { name: "Álgebra Lineal", code: 9},
            { name: "Física Newtoniana", code: 25942},

            //Programaciones
            { name: "Programación Básica", code: 2},
            { name: "Programación Orientada a Objetos", code: 10},
            { name: "Programación Avanzada", code: 410},
        ];

        for (const subjectData of subjects) {
            const existingSubject = await subjectRepository.findOne({ where: { name: subjectData.name } });

            if (existingSubject) {
                this.logger.log(`Subject ${subjectData.name} already exists`);
                continue;
            }

            const subject = subjectRepository.create(subjectData);
            await subjectRepository.save(subject);
            this.logger.log(`Subject ${subjectData.name} created`);
        }

        this.logger.log(`Subjects seeded successfully: ${subjects.length} subjects created`);
    }
}