import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CloudinaryService {
  private cloudinaryName?: string;
  private cloudinaryApiKey?: string;
  private cloudinaryApiSecret?: string;
 

  constructor(private configService: ConfigService) {
    // Do not throw at construction time so the app can start in environments
    // where Cloudinary is not configured (e.g., local development without uploads).
    // Defer validation to methods that actually require the credentials.
    this.cloudinaryName = this.configService.get<string>('CLOUDINARY_NAME');
    this.cloudinaryApiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    this.cloudinaryApiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
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

    // Ensure Cloudinary credentials are present at the time we need them
    if (!this.cloudinaryApiKey || !this.cloudinaryApiSecret || !this.cloudinaryName) {
      throw new InternalServerErrorException(
        'Cloudinary configuration is missing. Set CLOUDINARY_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to use uploads.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const paramsToSign = {
      folder,
      public_id,
      timestamp,
    };

    const stringToSign = Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key as keyof typeof paramsToSign]}`)
      .join('&');

    // Cloudinary requires the sorted param string plus the API secret.
    const string = `${stringToSign}${this.cloudinaryApiSecret}`;
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

    // If cloud name is not configured, we cannot validate against it
    if (!this.cloudinaryName) return false;

    // Verificar que sea URL HTTPS de Cloudinary con nuestro cloud name
    return url.includes(`res.cloudinary.com/${this.cloudinaryName}`);
  }

  /**
   * Extrae el cloud name (usado para validaciones)
   */
  getCloudName(): string {
    return this.cloudinaryName || '';
  }
}

