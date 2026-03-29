import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Enum simplificado para el frontend (no expone los estados internos)
export enum SessionStatusFilter {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class SessionFilterDto {
  @IsOptional()
  @IsEnum(SessionStatusFilter, {
    message: `status debe ser uno de: ${Object.values(SessionStatusFilter).join(', ')}`,
  })
  status?: SessionStatusFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}