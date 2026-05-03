// src/tutor/dto/update-tutor-profile.dto.ts
import {
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class UpdateTutorProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'Teléfono debe tener 10 dígitos',
  })
  phone?: string;

  // La URL de la imagen ahora la gestiona el administrador vía Cloudinary

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Debe agendar mínimo 1 hora semanal' })
  @Max(8, { message: 'Máximo 8 horas semanales' })
  max_weekly_hours?: number;

  @IsOptional()
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
