import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../modules/users/entities/user.entity';
import { Student, PreferredModality } from '../modules/student/entities/student.entity';
import { Tutor } from '../modules/tutor/entities/tutor.entity';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export class UsersSeeder {
  private readonly logger = new Logger(UsersSeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const userRepo = dataSource.getRepository(User);
    const studentRepo = dataSource.getRepository(Student);
    const tutorRepo = dataSource.getRepository(Tutor);

    const salt = await bcrypt.genSalt(10);
    const pwd = await bcrypt.hash('password123', salt);

    // ─── ADMIN ────────────────────────────────────────────────────────────────
    const adminExists = await userRepo.findOne({ where: { email: 'admin@sgt.com' } });
    if (!adminExists) {
      await userRepo.save(userRepo.create({
        name: 'Administrador Principal', email: 'admin@sgt.com', password: pwd,
        role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerified: true,
      }));
      this.logger.log('Admin seeded: admin@sgt.com');
    } else { this.logger.log('Admin already exists'); }

    // ─── TUTOR 1: Carlos Andrés Ramírez ──────────────────────────────────────
    const t1Exists = await userRepo.findOne({ where: { email: 'carlos.ramirez@sgt.com' } });
    if (!t1Exists) {
      const t1 = await userRepo.save(userRepo.create({
        name: 'Carlos Andrés Ramírez', email: 'carlos.ramirez@sgt.com', password: pwd,
        role: UserRole.TUTOR, status: UserStatus.ACTIVE, emailVerified: true,
        password_changed_at: new Date(),
      }));
      await tutorRepo.save(tutorRepo.create({
        idUser: t1.idUser, phone: '3012345678',
        isActive: true, limitDisponibility: 10, profile_completed: true,
      }));
      this.logger.log('Tutor seeded: Carlos Andrés Ramírez');
    } else { this.logger.log('Tutor Carlos already exists'); }

    // ─── TUTOR 2: María José Hernández ───────────────────────────────────────
    const t2Exists = await userRepo.findOne({ where: { email: 'maria.hernandez@sgt.com' } });
    if (!t2Exists) {
      const t2 = await userRepo.save(userRepo.create({
        name: 'María José Hernández', email: 'maria.hernandez@sgt.com', password: pwd,
        role: UserRole.TUTOR, status: UserStatus.ACTIVE, emailVerified: true,
        password_changed_at: new Date(),
      }));
      await tutorRepo.save(tutorRepo.create({
        idUser: t2.idUser, phone: '3209876543',
        isActive: true, limitDisponibility: 8, profile_completed: true,
      }));
      this.logger.log('Tutor seeded: María José Hernández');
    } else { this.logger.log('Tutor María already exists'); }

    // ─── ESTUDIANTE 1: Diego Felipe Torres ───────────────────────────────────
    const s1Exists = await userRepo.findOne({ where: { email: 'diego.torres@sgt.com' } });
    if (!s1Exists) {
      const s1 = await userRepo.save(userRepo.create({
        name: 'Diego Felipe Torres', email: 'diego.torres@sgt.com', password: pwd,
        role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerified: true,
      }));
      await studentRepo.save(studentRepo.create({
        idUser: s1.idUser, career: 'Ingeniería de Sistemas',
        preferredModality: PreferredModality.PRES,
      }));
      this.logger.log('Student seeded: Diego Felipe Torres');
    } else { this.logger.log('Student Diego already exists'); }

    // ─── ESTUDIANTE 2: Laura Valentina Ospina ────────────────────────────────
    const s2Exists = await userRepo.findOne({ where: { email: 'laura.ospina@sgt.com' } });
    if (!s2Exists) {
      const s2 = await userRepo.save(userRepo.create({
        name: 'Laura Valentina Ospina', email: 'laura.ospina@sgt.com', password: pwd,
        role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerified: true,
      }));
      await studentRepo.save(studentRepo.create({
        idUser: s2.idUser, career: 'Ingeniería Industrial',
        preferredModality: PreferredModality.VIRT,
      }));
      this.logger.log('Student seeded: Laura Valentina Ospina');
    } else { this.logger.log('Student Laura already exists'); }

    // ─── ESTUDIANTE 3: Sebastián Mora Gómez ──────────────────────────────────
    const s3Exists = await userRepo.findOne({ where: { email: 'sebastian.mora@sgt.com' } });
    if (!s3Exists) {
      const s3 = await userRepo.save(userRepo.create({
        name: 'Sebastián Mora Gómez', email: 'sebastian.mora@sgt.com', password: pwd,
        role: UserRole.STUDENT, status: UserStatus.ACTIVE, emailVerified: true,
      }));
      await studentRepo.save(studentRepo.create({
        idUser: s3.idUser, career: 'Ingeniería Electrónica',
        preferredModality: PreferredModality.PRES,
      }));
      this.logger.log('Student seeded: Sebastián Mora Gómez');
    } else { this.logger.log('Student Sebastián already exists'); }

    this.logger.log('UsersSeeder completed.');
  }
}
