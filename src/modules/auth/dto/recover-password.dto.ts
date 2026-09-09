// src/auth/dto/recover-password.dto.ts
import { IsEmail } from 'class-validator';

export class RecoverPasswordDto {
  @IsEmail({}, { message: 'Email debe ser válido' })
  email: string;
}
