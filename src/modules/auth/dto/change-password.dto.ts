// src/auth/dto/change-password.dto.ts
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Nueva contraseña debe incluir mayúsculas, minúsculas, números y caracteres especiales',
  })
  newPassword: string;

  @IsString()
  confirmNewPassword: string;
}