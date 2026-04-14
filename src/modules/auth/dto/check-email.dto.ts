import { IsEmail, IsNotEmpty } from 'class-validator';
import { IsInstitutionalEmail } from '../decorators/is-institutional-email.decorator';

export class CheckEmailDto {
  @IsNotEmpty()
  @IsEmail()
  @IsInstitutionalEmail({
    message: 'El correo debe ser institucional (@udistrital.edu.co)',
  })
  email: string;
}
