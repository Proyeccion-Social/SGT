import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Modality } from '../enums/modality.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FilterTutorsDetailedDto extends PaginationDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value.map((id) => (typeof id === 'string' ? id.trim() : id));
    }

    return value;
  })
  @Type(() => String)
  subjectIds?: string[];

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
