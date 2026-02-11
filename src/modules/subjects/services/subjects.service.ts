// src/subjects/services/subject.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Subject } from '../entities/subjects.entity';
import { TutorImpartSubject } from '../entities/tutor-subject.entity';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject,'local')
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(TutorImpartSubject,'local')
    private readonly tutorImpartSubjectRepository: Repository<TutorImpartSubject>,
  ) {}

  // =====================================================
  // CRUD BÁSICO DE SUBJECTS
  // =====================================================

  /**
   * Obtener una materia por ID
   */
  async findById(id: string): Promise<Subject | null> {
    return await this.subjectRepository.findOne({
      where: { idSubject: id },
    });
  }

  /**
   * Obtener múltiples materias por IDs
   */
  async findByIds(ids: string[]): Promise<Subject[]> {
    return await this.subjectRepository.find({
      where: { idSubject: In(ids) },
    });
  }

  /**
   * Validar que todas las materias existan
   */
  async validateSubjectsExist(ids: string[]): Promise<boolean> {
    const subjects = await this.findByIds(ids);
    return subjects.length === ids.length;
  }

  /**
   * Obtener todas las materias activas
   */
  async findAll(): Promise<Subject[]> {
    return await this.subjectRepository.find();
  }

  /**
   * Verificar si una materia existe
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.subjectRepository.count({
      where: { idSubject: id },
    });
    return count > 0;
  }

  // =====================================================
  // GESTIÓN DE RELACIÓN TUTOR-SUBJECT
  // =====================================================

  /**
   * Asignar materias a un tutor (reemplaza las existentes)
   */
  async assignSubjectsToTutor(
    tutorId: string,
    subjectIds: string[],
  ): Promise<void> {
    // 1. Validar que las materias existan
    const subjectsExist = await this.validateSubjectsExist(subjectIds);
    if (!subjectsExist) {
      throw new NotFoundException('One or more subjects do not exist');
    }

    // 2. Eliminar asignaciones anteriores
    await this.tutorImpartSubjectRepository.delete({
      idTutor: tutorId,
    });

    // 3. Crear nuevas asignaciones
    const relations = subjectIds.map((subjectId) =>
      this.tutorImpartSubjectRepository.create({
        idTutor: tutorId,
        idSubject: subjectId,
      }),
    );

    await this.tutorImpartSubjectRepository.save(relations);
  }

  /**
   * Agregar una materia a un tutor (sin eliminar las existentes)
   */
  async addSubjectToTutor(tutorId: string, subjectId: string): Promise<void> {
    // 1. Validar que la materia exista
    const subject = await this.findById(subjectId);
    if (!subject) {
      throw new NotFoundException(`Subject with id ${subjectId} not found`);
    }

    // 2. Verificar si ya existe la relación
    const existing = await this.tutorImpartSubjectRepository.findOne({
      where: { idTutor: tutorId, idSubject: subjectId },
    });

    if (existing) {
      return; // Ya existe, no hacer nada
    }

    // 3. Crear la relación
    const relation = this.tutorImpartSubjectRepository.create({
      idTutor: tutorId,
      idSubject: subjectId,
    });

    await this.tutorImpartSubjectRepository.save(relation);
  }

  /**
   * Remover una materia de un tutor
   */
  async removeSubjectFromTutor(
    tutorId: string,
    subjectId: string,
  ): Promise<void> {
    await this.tutorImpartSubjectRepository.delete({
      idTutor: tutorId,
      idSubject: subjectId,
    });
  }

  /**
   * Obtener todas las materias que imparte un tutor
   */
  async getSubjectsByTutor(tutorId: string): Promise<Subject[]> {
    const relations = await this.tutorImpartSubjectRepository.find({
      where: { idTutor: tutorId },
      relations: ['subject'],
    });

    return relations.map((r) => r.subject);
  }

  /**
   * Obtener todos los tutores que imparten una materia
   */
  async getTutorsBySubject(subjectId: string): Promise<string[]> {
    const relations = await this.tutorImpartSubjectRepository.find({
      where: { idSubject: subjectId },
    });

    return relations.map((r) => r.idTutor);
  }

  /**
   * Verificar si un tutor imparte una materia específica
   */
  async tutorTeachesSubject(
    tutorId: string,
    subjectId: string,
  ): Promise<boolean> {
    const count = await this.tutorImpartSubjectRepository.count({
      where: { idTutor: tutorId, idSubject: subjectId },
    });

    return count > 0;
  }

  /**
   * Obtener cantidad de materias que imparte un tutor
   */
  async countSubjectsByTutor(tutorId: string): Promise<number> {
    return await this.tutorImpartSubjectRepository.count({
      where: { idTutor: tutorId },
    });
  }

  /**
   * Eliminar todas las asignaciones de un tutor (cuando se elimina/desactiva)
   */
  async removeAllSubjectsFromTutor(tutorId: string): Promise<void> {
    await this.tutorImpartSubjectRepository.delete({
      idTutor: tutorId,
    });
  }
}