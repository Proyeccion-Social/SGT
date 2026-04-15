// src/scheduling/dto/create-individual-session.dto.ts
import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator';
import { Modality } from '../../availability/enums';

export class CreateIndividualSessionDto {
  @IsUUID('4', { message: 'tutorId debe ser un UUID válido' })
  tutorId: string;

  @IsUUID('4', { message: 'subjectId debe ser un un UUID válido' })
  subjectId: string;

  @IsNumber({}, { message: 'availabilityId debe ser un numero válido' })
  availabilityId: number;

  @IsDateString({}, { message: 'scheduledDate debe tener formato YYYY-MM-DD' })
  scheduledDate: string; // YYYY-MM-DD

  @IsEnum(Modality, { message: 'modality debe ser PRES o VIRT' })
  modality: Modality;

  @IsNumber()
  @IsIn([1, 1.5, 2], { message: 'durationHours debe ser 1, 1.5 o 2' })
  durationHours: number; // Se usa para calcular endTime, no se guarda

  @IsString()
  @MinLength(5, { message: 'El título debe tener al menos 5 caracteres' })
  @MaxLength(100, { message: 'El título no puede superar 100 caracteres' })
  title: string;

  @IsString()
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres' })
  description: string;
}