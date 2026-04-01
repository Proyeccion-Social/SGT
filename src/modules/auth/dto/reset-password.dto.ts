// src/auth/dto/reset-password.dto.ts
import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Contraseña debe incluir mayúsculas, minúsculas, números y caracteres especiales',
  })
  password: string;

  @IsString()
  confirmPassword: string;
}
