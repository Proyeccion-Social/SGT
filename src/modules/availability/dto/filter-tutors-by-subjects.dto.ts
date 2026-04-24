import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Modality } from '../enums/modality.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FilterTutorsBySubjectsDto extends PaginationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, {
    message: 'Debe proporcionar al menos un ID de materia',
  })
  @Type(() => String)
  subjectIds: string[];

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  onlyAvailable?: boolean;

  @IsOptional()
  @IsDateString()
  weekStart?: string;
}
