// src/tutor/dto/create-tutor.dto.ts
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class CreateTutorDto {
  @IsString()
  @MinLength(3, { message: 'Nombre debe tener mínimo 3 caracteres' })
  name!: string;

  @IsEmail({}, { message: 'Email debe ser válido' })
  @Matches(/@udistrital\.edu\.co$/, {
    message: 'Email debe ser institucional (@udistrital.edu.co)',
  })
  email!: string;
}