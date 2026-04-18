// src/scheduling/dto/confirm-session.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string; // Mensaje opcional del tutor al confirmar
}