// src/scheduling/dto/cancel-session.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CancelSessionDto {
  @IsString()
  @MinLength(10, {
    message: 'La justificación debe tener al menos 10 caracteres',
  })
  @MaxLength(500, {
    message: 'La justificación no puede superar 500 caracteres',
  })
  reason: string;
}
