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
  @Transform(({ value }) => {
    // Handle single string, array of strings, or CSV format
    if (typeof value === 'string') {
      // Support CSV: "uuid1,uuid2,uuid3"
      return value.split(',').map((id) => id.trim());
    }
    // Handle array (normal case: ?subjectIds=uuid1&subjectIds=uuid2)
    if (Array.isArray(value)) {
      return value.map((id) => (typeof id === 'string' ? id.trim() : id));
    }
    // Return as-is if already proper format
    return value;
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
