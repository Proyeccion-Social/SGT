import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { BusinessException } from '../exceptions/business.exception';
import { UserRole, UserStatus, ErrorCode } from '../enums';
import { User, EmailConfirmation } from '../entities';
import { RegisterStudentDto } from '../dto';
import { RegisterResponse } from '../interfaces';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly SALT_ROUNDS = 10;
    private readonly TOKEN_EXPIRATION_TIME = 8;    

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(EmailConfirmation)
        private readonly emailConfirmationRepository: Repository<EmailConfirmation>,
        private readonly notificationService: NotificationsService,
    ) {}

    //Metodo para registrar un estudiante
    async registerStudent( registerDto: RegisterStudentDto, ): Promise<RegisterResponse> {
        const { fullName, email, password } = registerDto;

        this.logger.log(`Iniciando registro de estudiante: ${email}`);

        try{
            //Verificación de la existencia del correo
            const existingUser = await this.userRepository.findOne({
                where: { email: email.toLowerCase()}
            });

            if (existingUser){
                this.logger.warn(`Intento de registro con correo existente: ${email}`);
                throw new BusinessException(
                    ErrorCode.RESOURCE_01,
                    'Correo ya registrado',
                    'El correo electrónico ya está registrado',
                    HttpStatus.CONFLICT,
                );
            }

            //Hasheo de la contraseña
            const passwordHash = await this.hashPassword(password);

            //Creación del usuario
            const user = this.userRepository.create({
                fullName,
                email: email.toLowerCase(),
                passwordHash,
                role: UserRole.STUDENT,
                status: UserStatus.PENDING,
                emailVerified: false,
            });

            const savedUser = await this.userRepository.save(user);
            this.logger.log(`Usuario registrado exitosamente: ${savedUser.id}`);

            //Generación del token de confirmación
            const confirmationToken = await this.createEmailConfirmationToken(savedUser.id);
        
            //Envío del correo de confirmación
            await this.notificationService.sendEmailConfirmation( savedUser.email, savedUser.fullName, confirmationToken);

            this.logger.log(`Proceso de registro completado exitosamente: ${email}`);

            return {
                message: 'Registro exitoso',
                email: savedUser.email,
            };
        }  catch (error){
            if (error instanceof BusinessException){
                throw error;
            }

            this.logger.error(`Error al registrar ${email}:`, error.stack,);
            throw new BusinessException(
                ErrorCode.INTERNAL_01,
                'Error interno del servidor',
                'Ocurrió un error interno al registrar al estudiante',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    //Metodo para hashear la contraseña
    private async hashPassword(password: string): Promise<string> {
        try{
            return await bcrypt.hash(password, this.SALT_ROUNDS)
        } catch (error){
            this.logger.error(`Error al hashear la contraseña:`, error.stack,);
            throw new BusinessException(
                ErrorCode.INTERNAL_01,
                'Error interno del servidor',
                'Ocurrió un error interno al hashear la contraseña',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    //Metodo para crear un token de confirmación
    private async createEmailConfirmationToken(userId: string): Promise<string> {
        try{
            const token = uuidv4();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRATION_TIME);

            const emailConfirmation = this.emailConfirmationRepository.create({
                userId,
                token,
                expiresAt,
                used: false,
            });

            await this.emailConfirmationRepository.save(emailConfirmation);

            this.logger.log(`Token de confirmación creado exitosamente para ${userId}, expira en ${expiresAt}`,);

            return token;   
        } catch (error){
            this.logger.error(`Error al crear el token de confirmación:`, error.stack,);
            throw new BusinessException(
                ErrorCode.INTERNAL_01,
                'Error interno del servidor',
                'Ocurrió un error interno al crear el token de confirmación',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    //Metodo para confirmar el correo
    async confirmEmail(token: string): Promise<{message: string}> {
        this.logger.log(`Confirmando correo con token: ${token}`);

        try{
            const emailConfirmation = await this.emailConfirmationRepository.findOne({
                where: { token },
                relations: ['user'],
            });

            if (!emailConfirmation){
                this.logger.warn(`Intento de confirmación con token inválido: ${token}`);
                throw new BusinessException(
                    ErrorCode.AUTH_01,
                    'Token inválido o expirado',
                    'El token de confirmación es inválido o ha expirado',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (emailConfirmation.used){
                this.logger.warn(`Intento de confirmación con token ya utilizado: ${token}`);
                throw new BusinessException(
                    ErrorCode.AUTH_02,
                    'Token ya utilizado',
                    'El token de confirmación ya ha sido utilizado',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (new Date() > emailConfirmation.expiresAt){
                throw new BusinessException(
                    ErrorCode.AUTH_01,
                    'Token inválido o expirado',
                    'El token de confirmación es inválido o ha expirado',
                    HttpStatus.BAD_REQUEST,
                );
            }

            emailConfirmation.user.emailVerified = true;
            emailConfirmation.user.status = UserStatus.ACTIVE;
            await this.userRepository.save(emailConfirmation.user);
            
            emailConfirmation.used = true;
            await this.emailConfirmationRepository.save(emailConfirmation);
            
            await this.notificationService.sendWelcomeEmail(
                emailConfirmation.user.email,
                emailConfirmation.user.fullName,
            )

            this.logger.log(`Correo confirmado exitosamente para ${emailConfirmation.user.email}`);

            return { message: 'Correo confirmado exitosamente, puedes iniciar sesión' };
        } catch (error){
            if(error instanceof BusinessException){
                throw error;
            }

            this.logger.error(`Error al confirmar el correo:`, error.stack,);
            throw new BusinessException(
                ErrorCode.INTERNAL_01,
                'Error interno del servidor',
                'Ocurrió un error interno al confirmar el correo',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
