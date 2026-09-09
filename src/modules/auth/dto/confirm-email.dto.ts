// src/auth/dto/confirm-email.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  frontendUrl?: string;
}
