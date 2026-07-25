import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class ConfirmBannerUploadDto {
  @IsString()
  @IsNotEmpty()
  secure_url: string;

  @IsString()
  @IsNotEmpty()
  public_id: string;

  // URL de destino a la que se redirige al usuario al hacer clic
  // en el banner (ej. el post del evento, landing de la organización).
  @IsUrl({}, { message: 'targetUrl debe ser una URL válida' })
  targetUrl: string;
}