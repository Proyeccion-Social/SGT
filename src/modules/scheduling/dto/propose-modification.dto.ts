// src/scheduling/dto/propose-modification.dto.ts
import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Modality } from 'src/modules/availability/enums/modality.enum';

export class ProposeModificationDto {
  @IsOptional()
  @IsDateString()
  newScheduledDate?: string;

  @IsOptional()
  @IsNumber()
  newAvailabilityId?: number;

  @IsOptional()
  @IsEnum(Modality)
  newModality?: Modality;

  @IsOptional()
  @IsNumber()
  @IsIn([1, 1.5, 2])
  newDurationHours?: number; // Para calcular nuevo endTime
}