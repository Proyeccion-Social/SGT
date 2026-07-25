// src/modules/dashboard/services/dashboard-banner.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardBanner } from '../entities/dashboard-banner.entity';
import { ConfirmBannerUploadDto } from '../dto/confirm-banner-upload-dto';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';

@Injectable()
export class DashboardBannerService {
  constructor(
    @InjectRepository(DashboardBanner, 'local')
    private readonly bannerRepository: Repository<DashboardBanner>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // =====================================================
  // CONSULTA — accesible para cualquier usuario autenticado
  // =====================================================

  /**
   * Devuelve el banner activo, o null si nunca se ha configurado uno.
   * Se usa GET (no lanza 404) porque "sin banner" es un estado válido
   * del dashboard, no un error — el frontend simplemente no renderiza
   * nada en ese caso.
   */
  async getActiveBanner(): Promise<{
    imageUrl: string;
    targetUrl: string;
    updatedAt: Date;
  } | null> {
    const banner = await this.bannerRepository.findOne({ where: { id: 1 } });

    if (!banner) {
      return null;
    }

    return {
      imageUrl: banner.imageUrl,
      targetUrl: banner.targetUrl,
      updatedAt: banner.updatedAt,
    };
  }

  // =====================================================
  // SUBIDA — solo ADMIN
  // Mismo patrón de firma que TutorService.getAvatarUploadSignature
  // =====================================================

  /**
   * Genera los parámetros firmados para que el frontend suba
   * directamente a Cloudinary, sin pasar el binario por el backend.
   */
  getUploadSignature() {
    // Carpeta y public_id fijos: cada subida nueva SOBRESCRIBE
    // la imagen anterior en Cloudinary (mismo public_id siempre),
    // coherente con el requisito de "no guardar imágenes anteriores".
    const folder = 'dashboard/banner';
    const public_id = 'dashboard/banner/current';

    return this.cloudinaryService.generateUploadSignature(folder, public_id);
  }

  /**
   * Valida que la URL de la imagen realmente pertenece a la carpeta
   * del banner del dashboard, previniendo que se confirme cualquier
   * URL arbitraria de Cloudinary como si fuera el banner.
   */
  private validateBannerUrl(url: string): boolean {
    if (!url) return false;
    return url.includes('dashboard/banner');
  }

  /**
   * Confirma la subida: persiste (crea o reemplaza) el único registro
   * de banner, igual que TutorService.confirmAvatarUpload hace con
   * tutor.urlImage.
   */
  async confirmBannerUpload(
    adminId: string,
    dto: ConfirmBannerUploadDto,
  ): Promise<{ message: string }> {
    if (!this.validateBannerUrl(dto.secure_url)) {
      throw new NotFoundException({
        errorCode: 'VALIDATION_01',
        message: 'La URL de la imagen no corresponde al banner del dashboard',
      });
    }

    let banner = await this.bannerRepository.findOne({ where: { id: 1 } });

    if (!banner) {
      banner = this.bannerRepository.create({ id: 1 });
    }

    banner.imageUrl = dto.secure_url;
    banner.targetUrl = dto.targetUrl;
    banner.updatedBy = adminId;

    await this.bannerRepository.save(banner);

    return { message: 'Banner del dashboard actualizado correctamente' };
  }

  // =====================================================
  // ELIMINACIÓN — solo ADMIN
  // Permite "apagar" el banner sin necesidad de otro despliegue
  // =====================================================

  async removeBanner(): Promise<{ message: string }> {
    await this.bannerRepository.delete({ id: 1 });
    return { message: 'Banner del dashboard eliminado' };
  }
}
