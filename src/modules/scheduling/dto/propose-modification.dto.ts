// src/scheduling/dto/propose-modification.dto.ts
import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsIn,
} from 'class-validator';
import { SessionModality } from '../enums/session-modality.enum';

export class ProposeModificationDto {
  @IsOptional()
  @IsDateString()
  newScheduledDate?: string;

  @IsOptional()
  @IsUUID()
  newAvailabilityId?: string;

  @IsOptional()
  @IsEnum(SessionModality)
  newModality?: SessionModality;

  @IsOptional()
  @IsNumber()
  @IsIn([1, 1.5, 2])
  newDurationHours?: number; // Para calcular nuevo endTime
}