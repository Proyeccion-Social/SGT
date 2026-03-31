import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SessionRatingsDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  clarity: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  patience: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  punctuality: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  knowledge: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  usefulness: number;
}

export class SendSessionEvaluationDto {
  @IsObject()
  @ValidateNested()
  @Type(() => SessionRatingsDto)
  ratings: SessionRatingsDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
