// src/modules/tutor/dto/confirm-avatar-upload.dto.ts

import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class ConfirmAvatarUploadDto {
  @IsUrl({}, { message: 'URL de imagen debe ser válida' })
  secure_url!: string;

  @IsString()
  @IsNotEmpty({ message: 'public_id es requerido' })
  public_id!: string;
}
