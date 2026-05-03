// src/modules/tutor/dto/cloudinary-signature.dto.ts

export class CloudinarySignatureDto {
  timestamp!: string;
  signature!: string;
  api_key!: string;
  cloud_name!: string;
  folder!: string;
  public_id!: string;
}
