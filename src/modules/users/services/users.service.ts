// src/users/services/user.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
}

export interface CreateTutorUserData {
  name: string;
  email: string;
  temporaryPassword: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User,'local')
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Crear un nuevo usuario (genérico)
   */
  async create(data: CreateUserData): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.userRepository.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role,
      status: data.status || UserStatus.PENDING,
      emailVerified: false,
      password_changed_at: new Date(),
    });

    return await this.userRepository.save(user);
  }

  /**
   * Crear usuario tutor con contraseña temporal (para admin)
   */
  async createTutorUser(data: CreateTutorUserData): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.temporaryPassword, 10);

    const user = this.userRepository.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: UserRole.TUTOR,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      email_verified_at: new Date(),
      password_changed_at: null, //  NULL indica contraseña temporal
    });

    return await this.userRepository.save(user);
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Buscar usuario por ID
   */
  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { idUser: id },
    });
  }

  async findByIds(ids: string[]): Promise<User[]> {
  if (!ids.length) return [];
  return this.userRepository.findBy({ idUser: In(ids) });
}

  /**
   * Verificar si existe un usuario con ese email
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Verificar si un usuario es admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.ADMIN;
  }

  /**
   * Verificar si un usuario es tutor
   */
  async isTutor(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.TUTOR;
  }

  /**
   * Verificar si tiene contraseña temporal (password_changed_at es null)
   */
  async hasTemporaryPassword(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user ? !user.password_changed_at : false;
  }

  /**
   * Actualizar verificación de email
   */
  async markEmailAsVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      email_verified_at: new Date(),
      emailVerified: true,
      status: UserStatus.ACTIVE,
    });
  }

  /**
   * Actualizar contraseña
   */
  async updatePassword(
    userId: string,
    newPassword: string,
    options?: {
      resetFailedAttempts?: boolean;
      unlockAccount?: boolean;
    },
  ): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateData: any = {
      password: hashedPassword,
      password_changed_at: new Date(),
    };

    if (options?.resetFailedAttempts) {
      updateData.failed_login_attempts = 0;
    }

    if (options?.unlockAccount) {
      updateData.locked_until = null;
    }

    await this.userRepository.update(userId, updateData);
  }

  /**
   * Incrementar intentos fallidos de login
   */
  async incrementFailedLoginAttempts(userId: string): Promise<number> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const newAttempts = user.failed_login_attempts + 1;

    await this.userRepository.update(userId, {
      failed_login_attempts: newAttempts,
    });

    return newAttempts;
  }

  /**
   * Bloquear cuenta
   */
  async lockAccount(userId: string, lockedUntil: Date): Promise<void> {
    await this.userRepository.update(userId, {
      locked_until: lockedUntil,
    });
  }

  /**
   * Desbloquear cuenta
   */
  async unlockAccount(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      locked_until: null,
      failed_login_attempts: 0,
    });
  }

  /**
   * Resetear intentos fallidos
   */
  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failed_login_attempts: 0,
    });
  }

  /**
   * Verificar si la cuenta está bloqueada
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) return false;

    return !!(user.locked_until && user.locked_until > new Date());
  }

  /**
   * Validar contraseña
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }
}