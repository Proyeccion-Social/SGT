import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum SessionStatusFilter {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class SessionFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SessionStatusFilter, {
    message: `status debe ser uno de: ${Object.values(SessionStatusFilter).join(', ')}`,
  })
  status?: SessionStatusFilter;
}