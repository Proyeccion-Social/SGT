import { IsOptional, IsDateString, IsUUID } from 'class-validator';

export class GetTutorMetricsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
