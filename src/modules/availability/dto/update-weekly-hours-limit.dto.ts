import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class UpdateWeeklyHoursLimitDto {
  @IsNotEmpty({ message: 'El límite semanal es requerido' })
  @IsInt({ message: 'El límite semanal debe ser un número entero' })
  @Min(1, { message: 'Debe agendar mínimo 1 hora semanal' })
  @Max(8, { message: 'Máximo 8 horas semanales' })
  maxWeeklyHours!: number;
}
