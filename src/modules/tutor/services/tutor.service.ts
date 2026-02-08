// src/tutor/services/tutor.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Tutor } from '../entities/tutor.entity';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { TutorImpartSubject } from '../../subjects/entities/tutor-subject.entity';
import { Subject } from '../../subjects/entities/subjects.entity';
import { CreateTutorDto } from '../dto/create-tutor.dto';
import { CompleteTutorProfileDto } from '../dto/complete-tutor-profile.dto';
import { TutorPublicProfileDto } from '../dto/tutor-public-profile.dto';
import { EmailService } from '../../notifications/services/email.service';

@Injectable()
export class TutorService {
  constructor(
    @InjectRepository(Tutor)
    private tutorRepository: Repository<Tutor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TutorImpartSubject)
    private tutorImpartSubjectRepository: Repository<TutorImpartSubject>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    private emailService: EmailService,
  ) {}

  // =====================================================
  // RF08: CREAR TUTOR (ADMIN)
  // =====================================================
  async createByAdmin(adminId: string, dto: CreateTutorDto) {
  const admin = await this.userRepository.findOne({
    where: { idUser: adminId },
  });

  if (!admin || admin.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Only administrators can create tutors');
  }

  if (!dto.email.endsWith('@udistrital.edu.co')) {
    throw new BadRequestException('Email must be institutional');
  }

  const existingUser = await this.userRepository.findOne({
    where: { email: dto.email },
  });

  if (existingUser) {
    throw new BadRequestException('Email already exists');
  }

  const temporaryPassword = this.generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const user = await this.userRepository.save(
    this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.TUTOR,
      status: UserStatus.ACTIVE,
      password_changed_at: null,
      email_verified_at: new Date(),
    }),
  );

  const savedUser = await this.userRepository.save(user);

  const tutor = this.tutorRepository.create({
    idUser: savedUser.idUser, //  relación, no FK manual
    phone: null,
    isActive: false,
    profile_completed: false,
    urlImage: null,
    limitDisponibility: null,
  });

  await this.tutorRepository.save(tutor);

  await this.emailService.sendTutorCredentials(
    user.email,
    user.name,
    temporaryPassword,
  );

  return {
    message: 'Tutor created successfully',
    tutor: {
      id: user.idUser,
      name: user.name,
      email: user.email,
    },
  };
}

  // =====================================================
  // RF09: COMPLETAR PERFIL DE TUTOR
  // =====================================================
  async completeProfile(userId: string, dto: CompleteTutorProfileDto) {
  const user = await this.userRepository.findOne({
    where: { idUser: userId },
  });

  if (!user || user.role !== UserRole.TUTOR) {
    throw new ForbiddenException();
  }

  if (!user.password_changed_at) {
    throw new BadRequestException('Change password first');
  }

  const tutor = await this.tutorRepository.findOne({
    where: { user: { idUser: userId } },
    relations: ['tutorImpartSubjects'],
  });

  if (!tutor) throw new NotFoundException();

  const subjects = await this.subjectRepository.find({
    where: { idSubject: In(dto.subject_ids) },
  });

  tutor.phone = dto.phone;
  tutor.urlImage = dto.url_image;
  tutor.limitDisponibility = dto.max_weekly_hours;
  tutor.profile_completed = true;
  tutor.isActive = true;

  await this.tutorRepository.save(tutor);

  await this.tutorImpartSubjectRepository.delete({
    tutor: { idUser: tutor.idUser },
  });

  const relations = dto.subject_ids.map((id) =>
    this.tutorImpartSubjectRepository.create({
      tutor,
      subject: { id_subject: id } as any,
    }),
  );

  await this.tutorImpartSubjectRepository.save(relations);

  return { message: 'Profile completed successfully' };
}


  // =====================================================
  // RF11: CONSULTAR PERFIL PÚBLICO
  // =====================================================
  async getPublicProfile(tutorId: string): Promise<TutorPublicProfileDto> {
    // 1. Buscar tutor con relaciones
    const tutor = await this.tutorRepository.findOne({
      where: {
        idUser: tutorId,
        profile_completed: true, // Solo perfiles completos
        isActive: true, // Solo activos
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

    // 2. Calcular rating promedio (placeholder, implementar cuando exista tabla ratings)
    const averageRating = 0; // await this.ratingService.getAverageRating(tutorId);
    const totalRatings = 0; // await this.ratingService.getTotalRatings(tutorId);

    // 3. Contar sesiones completadas (placeholder, implementar cuando exista lógica)
    const completedSessions = 0; // await this.sessionService.getCompletedCount(tutorId);

    // 4. Obtener modalidades disponibles
    const availableModalities = [
  ...new Set(
    tutor.tutorHaveAvailabilities
      .filter((ta) => ta.modality !== null)
      .map((ta) => ta.modality),
  ),
];


    // 5. Calcular horas usadas esta semana (placeholder)
    const currentWeekHoursUsed = 0; // await this.sessionService.getWeekHours(tutorId);
    const availableHoursThisWeek =
      tutor.limitDisponibility - currentWeekHoursUsed;

    return {
      id: tutor.idUser,
      name: tutor.user.name,
      photo: tutor.urlImage,
      subjects: tutor.tutorImpartSubjects.map((ts) => ({
        id: ts.subject.idSubject.toString(),
        name: ts.subject.name,
      })),
      averageRating,
      totalRatings,
      completedSessions,
      availableModalities,
      maxWeeklyHours: tutor.limitDisponibility,
      currentWeekHoursUsed,
      availableHoursThisWeek: Math.max(0, availableHoursThisWeek),
    };
  }

  // =====================================================
  // HELPERS PRIVADOS
  // =====================================================
  private generateTemporaryPassword(): string {
    // Genera contraseña segura:
    // - 8 caracteres aleatorios
    // - Incluye mayúsculas, minúsculas, números
    // - Prefijo "Tutor" + año para identificar
    const randomPart = randomBytes(4).toString('hex'); // 8 chars hex
    const year = new Date().getFullYear();

    return `Tutor${year}!${randomPart}`;
    // Ejemplo: "Tutor2026!a8f3b2c1"
  }

  // Verificar si tutor tiene contraseña temporal
  async hasTemporaryPassword(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { idUser: userId },
    });

    return !user?.password_changed_at; // NULL = temporal
  }

  // Verificar si perfil está completo
  async isProfileCompleted(userId: string): Promise<boolean> {
    const tutor = await this.tutorRepository.findOne({
      where: { idUser: userId },
    });

    return tutor?.profile_completed || false;
  }
}