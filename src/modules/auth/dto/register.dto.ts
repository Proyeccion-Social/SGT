// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_POLICY_MESSAGE,
} from '../constants/password-policy.constants';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Nombre debe tener mínimo 3 caracteres' })
  @MaxLength(255)
  name: string;

  @IsEmail({}, { message: 'Email debe ser válido' })
  @Matches(/@udistrital\.edu\.co$/, {
    message: 'Email debe ser institucional (@udistrital.edu.co)',
  })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Contraseña debe tener mínimo 8 caracteres' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @IsString()
  confirmPassword: string;
}
