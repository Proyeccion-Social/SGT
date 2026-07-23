import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  IsIn,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Modality } from '../../availability/enums';

export class CreateGroupSessionDto {
  @IsUUID('4', { message: 'tutorId debe ser un UUID válido' })
  tutorId: string;

  @IsUUID('4', { message: 'subjectId debe ser un UUID válido' })
  subjectId: string;

  @IsNumber({}, { message: 'availabilityId debe ser un número válido' })
  @Type(() => Number)
  availabilityId: number;

  @IsDateString({}, { message: 'scheduledDate debe tener formato YYYY-MM-DD' })
  scheduledDate: string;

  @IsEnum(Modality, { message: 'modality debe ser PRES o VIRT' })
  modality: Modality;

  @IsNumber()
  @Type(() => Number)
  @IsIn([0.5, 1, 1.5, 2], { message: 'durationHours debe ser 0.5, 1, 1.5 o 2' })
  durationHours: number;

  @IsString()
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres' })
  @MaxLength(100, { message: 'El título no puede superar 100 caracteres' })
  title: string;

  @IsString()
  @MinLength(10, {
    message: 'La descripción debe tener al menos 10 caracteres',
  })
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres' })
  description: string;

  // Sin mínimo exigido: la sesión parte de un solo estudiante (el creador)
  // y puede quedarse así indefinidamente si nadie más se une.
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1, { message: 'El cupo debe ser al menos 1' })
  @Max(30, { message: 'El cupo máximo permitido es 30 estudiantes' })
  maxParticipants?: number = 30;
}
