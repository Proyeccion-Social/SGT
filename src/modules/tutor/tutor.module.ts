// src/tutor/tutor.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tutor } from './entities/tutor.entity';
import { User } from '../users/entities/user.entity';
import { TutorImpartSubject } from '../subjects/entities/tutor-subject.entity';
import { Subject } from '../subjects/entities/subjects.entity';
import { Session } from '../scheduling/entities/session.entity';
import { TutorService } from './services/tutor.service';
import { TutorsController } from './controllers/tutor.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubjectsModule } from '../subjects/subjects.module'; // Importar el módulo de Subjects para poder usar su servicio dentro del TutorService
import { UsersModule } from '../users/users.module'; // Importar el módulo de Users para poder usar su servicio dentro del TutorService
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tutor, Session], 'local'), //Especificar la conexión 'local' para usar la configuración de TypeORM del entorno local
    SubjectsModule, //No había importado el módulo de Subjects, lo añado para poder usar el servicio de Subjects dentro del TutorService
    NotificationsModule, // Para EmailService
    UsersModule,
    CloudinaryModule,
  ],
  controllers: [TutorsController],
  providers: [TutorService],
  exports: [TutorService, TypeOrmModule],
})
export class TutorModule {}
