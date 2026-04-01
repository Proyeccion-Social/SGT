import { Module } from '@nestjs/common';
import { StudentService } from './services/student.service';
import { Student } from './entities/student.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
// src/student/student.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Student], 'local')],
  providers: [StudentService],
  exports: [StudentService, TypeOrmModule], //  Exportar para que otros módulos lo usen
})
export class StudentModule {}
