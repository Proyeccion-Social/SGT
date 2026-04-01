// src/scheduling/dto/update-session-details.dto.ts
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSessionDetailsDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  location?: string; // para presencial

  @IsOptional()
  @IsString()
  virtualLink?: string; // para virtual
}
