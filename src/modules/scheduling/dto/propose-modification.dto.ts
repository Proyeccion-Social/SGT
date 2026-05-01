// src/scheduling/dto/propose-modification.dto.ts
import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Modality } from '../../availability/enums/modality.enum';

export class ProposeModificationDto {
  @IsOptional()
  @IsDateString()
  newScheduledDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  newAvailabilityId?: number;

  @IsOptional()
  @IsEnum(Modality)
  newModality?: Modality;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsIn([0.5, 1, 1.5, 2], { message: 'durationHours debe ser 0.5, 1, 1.5 o 2' })
  newDurationHours?: number; // Para calcular nuevo endTime
}
