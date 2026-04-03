// src/tutor/services/tutor.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { Tutor } from '../entities/tutor.entity';
import { CreateTutorDto } from '../dto/create-tutor.dto';
import { CompleteTutorProfileDto } from '../dto/complete-tutor-profile.dto';
import { TutorPublicProfileDto } from '../dto/tutor-public-profile.dto';
import { AssignSubjectsDto } from '../../subjects/dto/assign-subjects.dto';
import { UserService } from '../../users/services/users.service';
import { SubjectsService } from '../../subjects/services/subjects.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UpdateTutorProfileDto } from '../dto/update-tutor-profile.dto';

@Injectable()
export class TutorService {
  constructor(
    @InjectRepository(Tutor, 'local')
    private readonly tutorRepository: Repository<Tutor>,
    private readonly userService: UserService,
    private readonly subjectService: SubjectsService,
    private readonly notificationService: NotificationsService,
  ) { }

  // =====================================================
  // RF08: CREAR TUTOR (ADMIN)
  // =====================================================
  async createByAdmin(adminId: string, dto: CreateTutorDto) {
    // 1. Verificar que quien crea es admin
    const isAdmin = await this.userService.isAdmin(adminId);
    if (!isAdmin) {
      throw new ForbiddenException('Only administrators can create tutors');
    }

    // 2. Validar email institucional
    if (!dto.email.endsWith('@udistrital.edu.co')) {
      throw new BadRequestException('Email must be institutional');
    }

    // 3. Verificar que el email no exista
    const exists = await this.userService.existsByEmail(dto.email);
    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    // 4. Generar contraseña temporal
    const temporaryPassword = this.generateTemporaryPassword();
    // Por ahora, para facilitar pruebas, la contraseña temporal se muestra en consola. En producción, solo se enviaría por email.
    console.log('TEMP PASSWORD:', temporaryPassword);


    // 5. Crear usuario tutor usando UserService
    const savedUser = await this.userService.createTutorUser({
      name: dto.name,
      email: dto.email,
      temporaryPassword,
    });

    // 6. Crear registro de tutor (esto sí es responsabilidad de TutorService)
    const tutor = this.tutorRepository.create({
      idUser: savedUser.idUser,
      phone: null,
      isActive: false,
      profile_completed: false,
      urlImage: null,
      limitDisponibility: null,
    });

    await this.tutorRepository.save(tutor);

    // 7. Enviar credenciales por email

    //Añado un try catch para evitar que falle la creación del tutor si el envío de correo falla, para probar sin el servicio de email por el momento

    try {
      await this.notificationService.sendTutorCredentials(
        savedUser.email,
        savedUser.name,
        temporaryPassword,
      );
    } catch (error) {
      // Log pero NO romper el flujo
      console.error(
        'Error sending tutor credentials email:',
        error instanceof Error ? error.message : error,
      );
    }

    return {
      message: 'Tutor created successfully',
      tutor: {
        id: savedUser.idUser,
        name: savedUser.name,
        email: savedUser.email,
      },
    };
  }

  // =====================================================
  // RF09: COMPLETAR PERFIL DE TUTOR
  // =====================================================
  async completeProfile(userId: string, dto: CompleteTutorProfileDto) {
    // 1. Verificar que sea tutor
    const isTutor = await this.userService.isTutor(userId);
    if (!isTutor) {
      throw new ForbiddenException('Only tutors can complete this profile');
    }

    // 2. Verificar que haya cambiado la contraseña temporal
    const hasTemporaryPassword =
      await this.userService.hasTemporaryPassword(userId);
    if (hasTemporaryPassword) {
      throw new BadRequestException('Change password first');
    }

    // 3. Buscar tutor
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: userId },
    });

    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }

    // 4. Actualizar datos del tutor
    tutor.phone = dto.phone;
    tutor.urlImage = dto.url_image;
    tutor.limitDisponibility = dto.max_weekly_hours;
    tutor.profile_completed = true;
    tutor.isActive = true;

    await this.tutorRepository.save(tutor);

    // 5.  Delegar la asignación de materias al SubjectService
    await this.subjectService.assignSubjectsToTutor(userId, dto.subject_ids);

    return { message: 'Profile completed successfully' };
  }

  // =====================================================
  // RF10: ACTUALIZAR PERFIL DE TUTOR
  // =====================================================
  async updateProfile(userId: string, dto: UpdateTutorProfileDto) {

    // 1. Verificar que sea tutor
    const isTutor = await this.userService.isTutor(userId);
    if (!isTutor) {
      throw new ForbiddenException('Only tutors can update this profile');
    }

    // 2. Buscar tutor
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: userId },
    });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }

    // 3. Actualizar datos del tutor
    if (dto.phone !== undefined) {
      tutor.phone = dto.phone;
    }
    if (dto.url_image !== undefined) {
      tutor.urlImage = dto.url_image;
    }
    if (dto.max_weekly_hours !== undefined) {
      tutor.limitDisponibility = dto.max_weekly_hours;
    }
    if (dto.subject_ids !== undefined) {
      // 4.  Delegar la asignación de materias al SubjectService
      await this.subjectService.assignSubjectsToTutor(userId, dto.subject_ids);
    }


    await this.tutorRepository.save(tutor);

    // 4.  Delegar la asignación de materias al SubjectService
    //await this.subjectService.assignSubjectsToTutor(userId, dto.subject_ids);

    return { message: 'Profile updated successfully' };
  }

  // =====================================================
  // RF11: CONSULTAR PERFIL PÚBLICO
  // =====================================================
  async getPublicProfile(tutorId: string): Promise<TutorPublicProfileDto> {
    // 1. Buscar tutor con relaciones
    const tutor = await this.tutorRepository.findOne({
      where: {
        idUser: tutorId,
        profile_completed: true,
        isActive: true,
      },
      relations: [
        'user',
        'tutorImpartSubjects',
        'tutorImpartSubjects.subject',
        'tutorHaveAvailabilities',
        'tutorHaveAvailabilities.availability',
      ],
    });

    if (!tutor) {
      throw new NotFoundException('Tutor not found or profile not completed');
    }

    // 2.  Obtener materias usando SubjectService (alternativa más limpia)
    const subjects = await this.subjectService.getSubjectsByTutor(tutorId);

    // 3. Calcular rating promedio (placeholder)
    const averageRating = 0;
    const totalRatings = 0;

    // 4. Contar sesiones completadas (placeholder)
    const completedSessions = 0;

    // 5. Obtener modalidades disponibles
    const availableModalities = [
      ...new Set(
        tutor.tutorHaveAvailabilities
          .filter((ta) => ta.modality !== null)
          .map((ta) => ta.modality),
      ),
    ];

    // 6. Calcular horas usadas esta semana (placeholder)
    const currentWeekHoursUsed = 0;
    const availableHoursThisWeek =
      (tutor.limitDisponibility ?? 0) - currentWeekHoursUsed;

    return {
      id: tutor.idUser,
      name: tutor.user.name,
      photo: tutor.urlImage,
      subjects: subjects.map((s) => ({
        id: s.idSubject.toString(),
        name: s.name,
      })),
      averageRating,
      totalRatings,
      completedSessions,
      availableModalities,
      maxWeeklyHours: tutor.limitDisponibility ?? 0,
      currentWeekHoursUsed,
      availableHoursThisWeek: Math.max(0, availableHoursThisWeek ?? 0),
    };
  }

  // =====================================================
  // RF12: CONSULTAR PERFIL PROPIO (TUTOR)
  // =====================================================
  async getOwnProfile(userId: string): Promise<TutorPublicProfileDto> {
    // 1. Verificar que sea tutor
    const isTutor = await this.userService.isTutor(userId);
    if (!isTutor) {
      throw new ForbiddenException('Only tutors can access this resource');
    }

    // 2. Buscar tutor con relaciones
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: userId },
      relations: [
        'user',
        'tutorImpartSubjects',
        'tutorImpartSubjects.subject',
        'tutorHaveAvailabilities',
        'tutorHaveAvailabilities.availability',
      ],
    });

    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }

    // 3. Obtener materias
    const subjects = await this.subjectService.getSubjectsByTutor(userId);

    // 4. Rating / sesiones (placeholders)
    const averageRating = 0;
    const totalRatings = 0;
    const completedSessions = 0;

    // 5. Modalidades disponibles
    const availableModalities = [
      ...new Set(
        tutor.tutorHaveAvailabilities
          .filter((ta) => ta.modality !== null)
          .map((ta) => ta.modality),
      ),
    ];

    // 6. Horas
    const currentWeekHoursUsed = 0;
    const availableHoursThisWeek =
      (tutor.limitDisponibility ?? 0) - currentWeekHoursUsed;

    return {
      id: tutor.idUser,
      name: tutor.user.name,
      photo: tutor.urlImage,
      subjects: subjects.map((s) => ({
        id: s.idSubject.toString(),
        name: s.name,
      })),
      averageRating,
      totalRatings,
      completedSessions,
      availableModalities,
      maxWeeklyHours: tutor.limitDisponibility ?? 0,
      currentWeekHoursUsed,
      availableHoursThisWeek: Math.max(0, availableHoursThisWeek),
    };
  }

  // =====================================================
  // RF14: Visualizar tutores por materia (Código o nombre parcial)
  // =====================================================
  async findTutorsBySubject(subjectTerm: string) {
    const query = this.tutorRepository.createQueryBuilder('tutor')
      .innerJoinAndSelect('tutor.user', 'user')
      .leftJoinAndSelect('tutor.tutorImpartSubjects', 'tutorImpartSubjects')
      .leftJoinAndSelect('tutorImpartSubjects.subject', 'subject')
      .where('tutor.isActive = :isActive', { isActive: true })
      .andWhere('tutor.profile_completed = :profileCompleted', { profileCompleted: true });

    query.andWhere('subject.name ILIKE :subjectName', { subjectName: `%${subjectTerm}%` });

    const tutors = await query.getMany();

    return tutors.map((tutor) => ({
      id: tutor.idUser,
      name: tutor.user.name,
      photo: tutor.urlImage,
      subjects: tutor.tutorImpartSubjects.map((tis) => ({
        id: tis.subject.idSubject,
        name: tis.subject.name,
      })),
      maxWeeklyHours: tutor.limitDisponibility,
    }));
  }


  // =====================================================
  // MÉTODOS AUXILIARES PARA AUTH
  // =====================================================

  /**
   * Crear registro de tutor asociado a un usuario
   */
  async createFromUser(userId: string): Promise<Tutor> {
    const tutor = this.tutorRepository.create({
      idUser: userId,
      profile_completed: false,
      isActive: false,
    });

    return await this.tutorRepository.save(tutor);
  }

  /**
   * Verificar si el perfil está completo
   */
  async isProfileComplete(userId: string): Promise<boolean> {
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: userId },
    });

    return tutor?.profile_completed ?? false;
  }

  /**
   * Obtener tutor por userId
   */
  async findByUserId(userId: string): Promise<Tutor | null> {
    return await this.tutorRepository.findOne({
      where: { idUser: userId },
    });
  }

  /**
   * Activar/desactivar tutor
   */
  async setActive(userId: string, isActive: boolean): Promise<void> {
    await this.tutorRepository.update(
      { idUser: userId },
      { isActive },
    );

    // Si se desactiva, eliminar asignaciones de materias
    if (!isActive) {
      await this.subjectService.removeAllSubjectsFromTutor(userId);
    }
  }

  /**
 * Verificar que un tutor existe y está activo
 */
  async validateTutorActive(tutorId: string): Promise<void> {
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: tutorId },
    });

    if (!tutor) {
      throw new NotFoundException('Tutor not found');
    }

    if (!tutor.isActive || !tutor.profile_completed) {
      throw new BadRequestException('Tutor is not active or profile not completed');
    }
  }

  //====================================================
  //METODOS AUXILIARES PARA SUBJECTS
  //====================================================
  /**
   * Asignar materias a tutor (método público para endpoint)
   */
  async assignSubjects(tutorId: string, dto: AssignSubjectsDto) {
    // Validar que el tutor exista
    const tutor = await this.findByUserId(tutorId);
    if (!tutor) {
      throw new NotFoundException('Tutor not found');
    }

    // Validar que el perfil esté completo
    if (!tutor.profile_completed) {
      throw new BadRequestException('Complete profile first');
    }

    // Delegar al SubjectsService (que ya valida límite de 4)
    await this.subjectService.assignSubjectsToTutor(tutorId, dto.subjects_ids);

    return {
      success: true,
      message: 'Subjects assigned successfully',
      total: dto.subjects_ids.length,
    };
  }

  /**
   * Obtener materias de un tutor (para endpoint público)
   */
  async getTutorSubjects(tutorId: string) {
    const subjects = await this.subjectService.getSubjectsByTutor(tutorId);

    return subjects.map(s => ({
      id: s.idSubject,
      name: s.name,

    }));
  }

  //====================================================
  //METODOS AUXILIARES PARA AVAILABILITY
  //====================================================

  /**
   * Obtener tutores con disponibilidad (para filtrado)
   */
  async getTutorsWithAvailability(
    tutorIds: string[],
    filters: any,
  ): Promise<any[]> {
    // TODO: Implementar filtrado por disponibilidad, calificación, etc.
    const tutors = await this.tutorRepository.find({
      where: {
        idUser: In(tutorIds),
        profile_completed: true,
        isActive: true,
      },
      relations: ['user', 'tutorHaveAvailabilities'],
    });

    return tutors.map(t => ({
      id: t.idUser,
      name: t.user.name,
      photo: t.urlImage,
      maxWeeklyHours: t.limitDisponibility,
      // TODO: agregar más campos según necesidad
    }));
  }

  /**
 * Obtener el límite semanal de horas de un tutor
 */
  async getWeeklyHoursLimit(tutorId: string): Promise<number> {
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: tutorId },
    });

    if (!tutor) {
      throw new NotFoundException('Tutor not found');
    }

    return tutor.limitDisponibility ?? 8;
  }

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================
  private generateTemporaryPassword(): string {
    const randomPart = randomBytes(4).toString('hex');
    const year = new Date().getFullYear();
    return `Tutor${year}!${randomPart}`;
  }
}