// src/availability/dto/get-availability-query.dto.ts
import { IsOptional, IsBoolean, IsEnum, IsDateString,IsInt,Min,} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Modality } from '../enums/modality.enum';

export class GetAvailabilityQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyAvailable?: boolean;
 
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyFuture?: boolean;
 
  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  /**
   * Lunes de la semana a consultar, formato YYYY-MM-DD.
   * Si no se pasa, se usa el lunes de la semana actual.
   *
   * El front puede usar esto para navegar semanas:
   *   Esta semana:     sin parámetro (o el lunes actual)
   *   Próxima semana:  ?weekStart=2025-04-21
   *   En dos semanas:  ?weekStart=2025-04-28
   */
  @IsOptional()
  @IsDateString({}, { message: 'weekStart debe ser una fecha válida en formato YYYY-MM-DD' })
  weekStart?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
