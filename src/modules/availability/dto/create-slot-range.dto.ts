import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { IsThirtyMinuteIncrement } from '../validators';

export class CreateSlotRangeDto {
  @IsNotEmpty({ message: 'El día de la semana es requerido' })
  @IsEnum(DayOfWeek, { message: 'Día de la semana inválido' })
  dayOfWeek!: DayOfWeek;

  @IsNotEmpty({ message: 'La hora de inicio es requerida' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Formato de hora inválido. Use HH:mm',
  })
  @IsThirtyMinuteIncrement({
    message: 'La hora de inicio debe estar en incrementos de 30 minutos (00 o 30)',
  })
  startTime!: string;

  @IsNotEmpty({ message: 'La hora de fin es requerida' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Formato de hora inválido. Use HH:mm',
  })
  @IsThirtyMinuteIncrement({
    message: 'La hora de fin debe estar en incrementos de 30 minutos (00 o 30)',
  })
  endTime!: string;

  @IsNotEmpty({ message: 'La modalidad es requerida' })
  @IsEnum(Modality, { message: 'Modalidad inválida (PRES o VIRT)' })
  modality!: Modality;
}
