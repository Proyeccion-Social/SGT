import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Request opcional para retirar una solicitud de tutoría sin confirmar. */
export class WithdrawSessionDto {
  /** Motivo opcional; cuando se envía debe contener entre 10 y 500 caracteres. */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
  reason?: string;
}
