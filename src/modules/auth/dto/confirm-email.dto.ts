// src/auth/dto/confirm-email.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
