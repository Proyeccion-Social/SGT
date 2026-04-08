// src/tutor/dto/complete-tutor-profile.dto.ts
import {
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class UpdateTutorProfileDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'Teléfono debe tener 10 dígitos',
  })
  phone?: string;

  @IsUrl({}, { message: 'URL de imagen debe ser válida' })
  url_image?: string;

  @IsInt()
  @Min(1, { message: 'Debe agendar mínimo 1 hora semanal' })
  @Max(40, { message: 'Máximo 40 horas semanales' })
  max_weekly_hours?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos 1 materia' })
  @IsUUID('4', { each: true })
  subject_ids?: string[];

  // Opcional: Disponibilidad (puede agregarse después)
  @IsOptional()
  @IsArray()
  availabilities?: Array<{
    day: string; // 'MONDAY', 'TUESDAY', etc
    start_time: string; // 'HH:MM'
    end_time: string; // 'HH:MM'
    modality: 'PRESENCIAL' | 'VIRTUAL';
    location?: string;
  }>;
}