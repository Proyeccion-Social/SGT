import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class GetTutorStatsDto {
  @IsOptional()
  @IsDateString({}, { message: 'Formato de fecha inválido' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Formato de fecha inválido' })
  endDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'subjectId debe ser UUID válido' })
  subjectId?: string;
}
