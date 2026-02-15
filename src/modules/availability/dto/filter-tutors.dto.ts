import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Modality } from '../entities/tutor-availability.entity';

export class FilterTutorsDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(7)
    @Type(() => Number)
    dayOfWeek?: number;

    @IsOptional()
    @IsString()
    startTime?: string;

    @IsOptional()
    @IsEnum(Modality)
    modality?: Modality;
}
