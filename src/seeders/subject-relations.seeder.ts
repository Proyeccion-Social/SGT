import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Subject } from '../modules/subjects/entities/subjects.entity';
import { User } from '../modules/users/entities/user.entity';
import { Tutor } from '../modules/tutor/entities/tutor.entity';
import { Student } from '../modules/student/entities/student.entity';
import { TutorImpartSubject } from '../modules/subjects/entities/tutor-subject.entity';
import { StudentInterestedSubject } from '../modules/subjects/entities/student-subject.entity';

export class SubjectRelationsSeeder {
  private readonly logger = new Logger(SubjectRelationsSeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const subjectRepo = dataSource.getRepository(Subject);
    const tutorRepo = dataSource.getRepository(Tutor);
    const studentRepo = dataSource.getRepository(Student);
    const tutorSubjectRepo = dataSource.getRepository(TutorImpartSubject);
    const studentSubjectRepo = dataSource.getRepository(StudentInterestedSubject);

    // Obtener entidades por nombre/email
    const tutors = {
      carlos: await dataSource.getRepository(User).findOne({ where: { email: 'carlos.ramirez@sgt.com' } }),
      maria: await dataSource.getRepository(User).findOne({ where: { email: 'maria.hernandez@sgt.com' } }),
    };
    const students = {
      diego: await dataSource.getRepository(User).findOne({ where: { email: 'diego.torres@sgt.com' } }),
      laura: await dataSource.getRepository(User).findOne({ where: { email: 'laura.ospina@sgt.com' } }),
      sebastian: await dataSource.getRepository(User).findOne({ where: { email: 'sebastian.mora@sgt.com' } }),
    };

    const getSubject = (name: string) => subjectRepo.findOne({ where: { name } });

    // ─── MATERIAS DE TUTORES ──────────────────────────────────────────────────
    // Carlos → Matemáticas
    const tutorSubjects: Array<{ email: string; subjects: string[] }> = [
      {
        email: 'carlos.ramirez@sgt.com',
        subjects: ['Cálculo Diferencial', 'Ecuaciones Diferenciales', 'Álgebra Lineal', 'Física Newtoniana'],
      },
      {
        email: 'maria.hernandez@sgt.com',
        subjects: ['Programación Básica', 'Programación Orientada a Objetos', 'Programación Avanzada', 'Matemáticas Discretas'],
      },
    ];

    for (const { email, subjects } of tutorSubjects) {
      const user = await dataSource.getRepository(User).findOne({ where: { email } });
      if (!user) { this.logger.warn(`Usuario ${email} no encontrado`); continue; }

      for (const subjectName of subjects) {
        const subject = await getSubject(subjectName);
        if (!subject) continue;
        const exists = await tutorSubjectRepo.findOne({
          where: { idTutor: user.idUser, idSubject: subject.idSubject },
        });
        if (!exists) {
          await tutorSubjectRepo.save(tutorSubjectRepo.create({ idTutor: user.idUser, idSubject: subject.idSubject }));
          this.logger.log(`Tutor ${email} → ${subjectName}`);
        }
      }
    }

    // ─── INTERESES DE ESTUDIANTES ─────────────────────────────────────────────
    const studentSubjects: Array<{ email: string; subjects: string[] }> = [
      {
        email: 'diego.torres@sgt.com',
        subjects: ['Cálculo Diferencial', 'Álgebra Lineal', 'Programación Orientada a Objetos'],
      },
      {
        email: 'laura.ospina@sgt.com',
        subjects: ['Ecuaciones Diferenciales', 'Matemáticas Discretas', 'Álgebra Lineal'],
      },
      {
        email: 'sebastian.mora@sgt.com',
        subjects: ['Programación Básica', 'Programación Avanzada', 'Cálculo Diferencial'],
      },
    ];

    for (const { email, subjects } of studentSubjects) {
      const user = await dataSource.getRepository(User).findOne({ where: { email } });
      if (!user) { this.logger.warn(`Usuario ${email} no encontrado`); continue; }

      for (const subjectName of subjects) {
        const subject = await getSubject(subjectName);
        if (!subject) continue;
        const exists = await studentSubjectRepo.findOne({
          where: { idStudent: user.idUser, idSubject: subject.idSubject },
        });
        if (!exists) {
          await studentSubjectRepo.save(studentSubjectRepo.create({ idStudent: user.idUser, idSubject: subject.idSubject }));
          this.logger.log(`Student ${email} → ${subjectName}`);
        }
      }
    }

    this.logger.log('SubjectRelationsSeeder completed.');
  }
}
