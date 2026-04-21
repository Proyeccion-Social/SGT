// src/student/services/student.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { StudentInterestedSubject } from '../../subjects/entities/student-subject.entity';
import { SubjectsService } from '../../subjects/services/subjects.service';
import {
  UpdateStudentPreferencesDto,
  UpdateInterestedSubjectsDto,
  StudentPreferencesResponseDto,
  StudentInterestedSubjectsResponseDto,
} from '../dto/update-student-preferences.dto';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student, 'local')
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(StudentInterestedSubject, 'local')
    private readonly studentInterestedSubjectRepository: Repository<StudentInterestedSubject>,
    private readonly subjectsService: SubjectsService,
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

  /**
   * Obtener preferencias del estudiante (carrera y modalidad preferida)
   */
  async getPreferences(userId: string): Promise<StudentPreferencesResponseDto> {
    const student = await this.studentRepository.findOne({
      where: { idUser: userId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    return {
      career: student.career,
      preferredModality: student.preferredModality,
    };
  }

  /**
   * Actualizar preferencias del estudiante (carrera y/o modalidad preferida)
   */
  async updatePreferences(
    userId: string,
    dto: UpdateStudentPreferencesDto,
  ): Promise<{ message: string }> {
    const student = await this.studentRepository.findOne({
      where: { idUser: userId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    if (dto.career !== undefined) {
      student.career = dto.career;
    }

    if (dto.preferredModality !== undefined) {
      student.preferredModality = dto.preferredModality;
    }

    await this.studentRepository.save(student);

    return {
      message: 'Preferencias actualizadas exitosamente',
    };
  }

  /**
   * Obtener materias de interés del estudiante
   */
  async getInterestedSubjects(
    userId: string,
  ): Promise<StudentInterestedSubjectsResponseDto> {
    const student = await this.studentRepository.findOne({
      where: { idUser: userId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    const interestedSubjects =
      await this.studentInterestedSubjectRepository.find({
        where: { idStudent: userId },
        relations: ['subject'],
      });

    return {
      subjects: interestedSubjects.map((item) => ({
        id: item.idSubject,
        name: item.subject.name,
      })),
    };
  }

  /**
   * Obtener preferencias del estudiante por su ID (para otros usuarios)
   * Usado por admin/tutores para ver información de estudiantes
   */
  async getPreferencesById(
    studentId: string,
  ): Promise<StudentPreferencesResponseDto> {
    const student = await this.studentRepository.findOne({
      where: { idUser: studentId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    return {
      career: student.career,
      preferredModality: student.preferredModality,
    };
  }

  /**
   * Obtener materias de interés del estudiante por su ID (para otros usuarios)
   * Usado por admin/tutores para ver información de estudiantes
   */
  async getInterestedSubjectsById(
    studentId: string,
  ): Promise<StudentInterestedSubjectsResponseDto> {
    const student = await this.studentRepository.findOne({
      where: { idUser: studentId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    const interestedSubjects =
      await this.studentInterestedSubjectRepository.find({
        where: { idStudent: studentId },
        relations: ['subject'],
      });

    return {
      subjects: interestedSubjects.map((item) => ({
        id: item.idSubject,
        name: item.subject.name,
      })),
    };
  }

  /**
   * Actualizar materias de interés del estudiante
   * Reemplaza completamente la lista anterior
   */
  async updateInterestedSubjects(
    userId: string,
    dto: UpdateInterestedSubjectsDto,
  ): Promise<{ message: string }> {
    // Verificar que el estudiante existe
    const student = await this.studentRepository.findOne({
      where: { idUser: userId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Validar que todas las materias existan
    if (dto.subjectIds.length > 0) {
      const allExist = await this.subjectsService.validateSubjectsExist(
        dto.subjectIds,
      );
      if (!allExist) {
        throw new NotFoundException(
          'Una o más materias especificadas no existen',
        );
      }
    }

    // Validar que no haya duplicados
    const uniqueIds = new Set(dto.subjectIds);
    if (uniqueIds.size !== dto.subjectIds.length) {
      throw new BadRequestException('No se pueden agregar materias duplicadas');
    }

    // Eliminar asignaciones existentes
    await this.studentInterestedSubjectRepository.delete({
      idStudent: userId,
    });

    // Crear nuevas asignaciones si hay materias
    if (dto.subjectIds.length > 0) {
      const newAssignments = dto.subjectIds.map((subjectId) =>
        this.studentInterestedSubjectRepository.create({
          idStudent: userId,
          idSubject: subjectId,
        }),
      );

      await this.studentInterestedSubjectRepository.save(newAssignments);
    }

    return {
      message: 'Materias de interés actualizadas exitosamente',
    };
  }
}
