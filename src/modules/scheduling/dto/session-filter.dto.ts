import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum SessionStatusFilter {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW', //sessiones COMPLETED donde el estado del estudiante fue ABSENT
}

export class SessionFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SessionStatusFilter, {
    message: `status debe ser uno de: ${Object.values(SessionStatusFilter).join(', ')}`,
  })
  status?: SessionStatusFilter;
}