// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

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
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Contraseña debe incluir mayúsculas, minúsculas, números y caracteres especiales',
  })
  password: string;

  @IsString()
  confirmPassword: string;
}
