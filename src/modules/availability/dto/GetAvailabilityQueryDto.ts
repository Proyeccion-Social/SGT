// src/availability/dto/get-availability-query.dto.ts
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Modality } from '../enums/modality.enum';

export class GetAvailabilityQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  onlyAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  onlyFuture?: boolean;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;
}