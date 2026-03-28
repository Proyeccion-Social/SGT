// src/scheduling/dto/reject-session.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class RejectSessionDto {
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
  reason: string;
}