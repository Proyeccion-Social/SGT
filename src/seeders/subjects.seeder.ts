import { DataSource } from "typeorm";
import { Subject } from "../modules/subjects/entities/subjects.entity";
import { Logger } from "@nestjs/common";

export class SubjectsSeeder {
    private readonly logger = new Logger(SubjectsSeeder.name);
    public async run(dataSource: DataSource): Promise<void> {
        const subjectRepository = dataSource.getRepository(Subject);

        const subjects = [
            //Matemáticas
            { name: "Cálculo Diferencial" },
            { name: "Cálculo Integral" },
            { name: "Ecuaciones Diferenciales" },
            { name: "Matemáticas Discretas" },
            { name: "Álgebra Lineal" },
            { name: "Física Newtoniana" },

            //Programaciones
            { name: "Programación Básica" },
            { name: "Programación Orientada a Objetos" },
            { name: "Programación Avanzada" },
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