import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsArray,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { PreferredModality } from '../entities/student.entity';

/**
 * DTO para actualizar preferencias del estudiante (carrera y modalidad)
 */
export class UpdateStudentPreferencesDto {
  @IsOptional()
  @IsString({
    message: 'La carrera debe ser una cadena de texto',
  })
  @MinLength(3, {
    message: 'La carrera debe tener mínimo 3 caracteres',
  })
  @MaxLength(100, {
    message: 'La carrera debe tener máximo 100 caracteres',
  })
  career?: string;

  @IsOptional()
  @IsEnum(PreferredModality, {
    message: 'La modalidad preferida debe ser PRES o VIRT',
  })
  preferredModality?: PreferredModality;
}

/**
 * DTO para actualizar las materias de interés del estudiante
 */
export class UpdateInterestedSubjectsDto {
  @IsArray({
    message: 'Las materias deben ser un array',
  })
  @ArrayMinSize(0, {
    message: 'Puede dejar sin materias de interés',
  })
  @ArrayMaxSize(10, {
    message: 'Puede seleccionar máximo 10 materias',
  })
  @IsUUID('all', {
    each: true,
    message: 'Cada ID de materia debe ser un UUID válido',
  })
  subjectIds: string[];
}

/**
 * DTO de respuesta para las preferencias del estudiante (GET)
 */
export class StudentPreferencesResponseDto {
  career: string | null;
  preferredModality: PreferredModality | null;
}

/**
 * DTO de respuesta para las materias de interés del estudiante (GET)
 */
export class StudentInterestedSubjectsResponseDto {
  subjects: Array<{
    id: string;
    name: string;
  }>;
}
