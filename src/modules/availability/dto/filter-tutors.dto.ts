// src/availability/dto/filter-tutors.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Modality } from '../enums/modality.enum';
import { UUID } from 'typeorm/driver/mongodb/bson.typings.js';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FilterTutorsDto extends PaginationDto {
  @IsOptional()
  @Type(() => UUID)
  @IsNumber()
  subjectId?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  onlyAvailable?: boolean;

  @IsOptional()
  @IsDateString()
  weekStart?: string; // Agregado para filtrar por semana específica
}
