import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Modality } from '../enums/modality.enum';
import { IsThirtyMinuteIncrement } from '../validators';

/**
 * DTO para actualizar una franja de disponibilidad.
 * No se puede actualizar dayOfWeek (debe eliminarse y crear una nueva).
 */
export class UpdateSlotDto {
  @IsNotEmpty({ message: 'El ID de la franja es requerido' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El ID de la franja debe ser un número' })
  @IsPositive({ message: 'El ID de la franja debe ser positivo' })
  slotId: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Formato de hora inválido. Use HH:mm',
  })
  @IsThirtyMinuteIncrement({
    message: 'La hora debe estar en incrementos de 30 minutos (00 o 30)',
  })
  startTime?: string;

  @IsOptional()
  @IsArray({ message: 'La modalidad debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una modalidad' })
  @IsEnum(Modality, {
    each: true,
    message: 'Modalidad inválida (PRES o VIRT)',
  })
  modality?: Modality[];
}
