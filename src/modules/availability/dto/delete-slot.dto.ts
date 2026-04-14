import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para eliminar una franja de disponibilidad.
 */
export class DeleteSlotDto {
  @IsNotEmpty({ message: 'El ID de la franja es requerido' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El ID de la franja debe ser un número' })
  @IsPositive({ message: 'El ID de la franja debe ser positivo' })
  slotId: number;
}
