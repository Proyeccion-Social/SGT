import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CloudinaryService {
  private cloudinaryName: string;
  private cloudinaryApiKey: string;
  private cloudinaryApiSecret: string;

  constructor(private configService: ConfigService) {
    try {
      this.cloudinaryName = this.configService.getOrThrow<string>('CLOUDINARY_NAME');
      this.cloudinaryApiKey = this.configService.getOrThrow<string>('CLOUDINARY_API_KEY');
      this.cloudinaryApiSecret = this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET');
    } catch (error) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing. Please set CLOUDINARY_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
      );
    }
  }

  /**
   * Genera firma para subida de archivo desde el cliente a Cloudinary
   * Esta es una operación TÉCNICA pura de Cloudinary
   * @param folder Carpeta en Cloudinary
   * @param public_id ID público del archivo
   * @returns Objeto con parámetros necesarios para la subida
   */
  generateUploadSignature(folder: string, public_id: string) {
    if (!folder || !public_id) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_01',
        message: 'folder y public_id son requeridos',
      });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Generar signature: SHA1(timestamp + api_secret)
    const string = `timestamp=${timestamp}${this.cloudinaryApiSecret}`;
    const signature = crypto
      .createHash('sha1')
      .update(string)
      .digest('hex');

    return {
      timestamp,
      signature,
      api_key: this.cloudinaryApiKey,
      cloud_name: this.cloudinaryName,
      folder,
      public_id,
    };
  }

  /**
   * Valida que la URL es válida de Cloudinary
   * Validación TÉCNICA: solo verifica el dominio
   * @param url URL a validar
   * @returns true si es válida URL de Cloudinary
   */
  isValidCloudinaryUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    // Verificar que sea URL HTTPS de Cloudinary con nuestro cloud name
    return url.includes(`res.cloudinary.com/${this.cloudinaryName}`);
  }

  /**
   * Extrae el cloud name (usado para validaciones)
   */
  getCloudName(): string {
    return this.cloudinaryName;
  }
}

