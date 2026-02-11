// src/student/services/student.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student,'local')
    private readonly studentRepository: Repository<Student>,
  ) {}

  /**
   * Crear registro de estudiante asociado a un usuario
   */
  async createFromUser(userId: string): Promise<Student> {
    const student = this.studentRepository.create({
      idUser: userId,
      career: null,
      preferredModality: null,
    });

    return await this.studentRepository.save(student);
  }

  /**
   * Verificar si el perfil está completo
   */
  async isProfileComplete(userId: string): Promise<boolean> {
    const student = await this.studentRepository.findOne({
      where: { idUser: userId },
    });

    return student ? !!(student.career && student.preferredModality) : false;
  }

  /**
   * Obtener estudiante por userId
   */
  async findByUserId(userId: string): Promise<Student | null> {
    return await this.studentRepository.findOne({
      where: { idUser: userId },
    });
  }
}