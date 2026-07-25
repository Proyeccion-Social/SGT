import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DashboardBannerService } from './dashboard-banner.service';
import { DashboardBanner } from '../entities/dashboard-banner.entity';
import { CloudinaryService } from '../../cloudinary/services/cloudinary.service';

// Define interfaces para los tipos
interface MockRepository {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
}

interface MockCloudinaryService {
  generateUploadSignature: jest.Mock;
}

interface BannerData {
  id: number;
  imageUrl: string;
  targetUrl: string;
  updatedBy: string;
  updatedAt: Date;
}

describe('DashboardBannerService', () => {
  let service: DashboardBannerService;
  let bannerRepository: MockRepository;
  let cloudinaryService: MockCloudinaryService;

  const makeExistingBanner = (
    overrides: Partial<BannerData> = {},
  ): BannerData => ({
    id: 1,
    imageUrl:
      'https://res.cloudinary.com/atlasproysocial/image/upload/v123/dashboard/banner/current.jpg',
    targetUrl: 'https://universidad.edu/eventos/semana-tecnologia',
    updatedBy: 'admin-1',
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    bannerRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: Partial<DashboardBanner>) => ({ ...data })),
      save: jest.fn((entity: DashboardBanner) => Promise.resolve(entity)), // Fix aquí
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    cloudinaryService = {
      generateUploadSignature: jest.fn().mockReturnValue({
        signature: 'fake-signature',
        timestamp: 1234567890,
        apiKey: 'fake-api-key',
        cloudName: 'atlasproysocial',
        folder: 'dashboard/banner',
        publicId: 'dashboard/banner/current',
      }),
    };

    service = new DashboardBannerService(
      bannerRepository as unknown as Repository<DashboardBanner>,
      cloudinaryService as unknown as CloudinaryService,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getActiveBanner
  // ═══════════════════════════════════════════════════════════════════════

  describe('getActiveBanner', () => {
    it('devuelve null cuando nunca se ha configurado un banner', async () => {
      bannerRepository.findOne.mockResolvedValue(null);

      const result = await service.getActiveBanner();

      expect(result).toBeNull();
    });

    it('devuelve imageUrl, targetUrl y updatedAt cuando existe un banner activo', async () => {
      const banner = makeExistingBanner();
      bannerRepository.findOne.mockResolvedValue(banner);

      const result = await service.getActiveBanner();

      expect(result).toEqual({
        imageUrl: banner.imageUrl,
        targetUrl: banner.targetUrl,
        updatedAt: banner.updatedAt,
      });
    });

    it('no expone el campo updatedBy en la respuesta pública', async () => {
      bannerRepository.findOne.mockResolvedValue(makeExistingBanner());

      const result = await service.getActiveBanner();

      expect(result).not.toHaveProperty('updatedBy');
    });

    it('consulta siempre por id=1 (fila única)', async () => {
      bannerRepository.findOne.mockResolvedValue(null);

      await service.getActiveBanner();

      expect(bannerRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getUploadSignature
  // ═══════════════════════════════════════════════════════════════════════

  describe('getUploadSignature', () => {
    it('genera la firma usando la carpeta y public_id fijos del banner', () => {
      const result = service.getUploadSignature();

      expect(cloudinaryService.generateUploadSignature).toHaveBeenCalledWith(
        'dashboard/banner',
        'dashboard/banner/current',
      );
      expect(result).toEqual(
        expect.objectContaining({
          signature: expect.any(String) as string,
        }),
      );
    });

    it('siempre usa el mismo public_id, sin importar cuántas veces se llame', () => {
      service.getUploadSignature();
      service.getUploadSignature();

      const calls = cloudinaryService.generateUploadSignature.mock.calls;
      expect(calls[0]).toEqual(calls[1]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // confirmBannerUpload
  // ═══════════════════════════════════════════════════════════════════════

  describe('confirmBannerUpload', () => {
    const validDto = {
      secure_url:
        'https://res.cloudinary.com/atlasproysocial/image/upload/v123/dashboard/banner/current.jpg',
      public_id: 'dashboard/banner/current',
      targetUrl: 'https://universidad.edu/eventos/semana-tecnologia',
    };

    it('rechaza si la URL no pertenece a la carpeta del banner', async () => {
      await expect(
        service.confirmBannerUpload('admin-1', {
          ...validDto,
          secure_url:
            'https://res.cloudinary.com/atlasproysocial/image/upload/v123/tutors/xyz/avatar.jpg',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(bannerRepository.save).not.toHaveBeenCalled();
    });

    it('rechaza si secure_url viene vacío', async () => {
      await expect(
        service.confirmBannerUpload('admin-1', { ...validDto, secure_url: '' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('crea el registro cuando nunca ha existido un banner', async () => {
      bannerRepository.findOne.mockResolvedValue(null);

      const result = await service.confirmBannerUpload('admin-1', validDto);

      expect(bannerRepository.create).toHaveBeenCalledWith({ id: 1 });
      expect(bannerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          imageUrl: validDto.secure_url,
          targetUrl: validDto.targetUrl,
          updatedBy: 'admin-1',
        }),
      );
      expect(result.message).toContain('actualizado');
    });

    it('sobrescribe el registro existente en lugar de crear uno nuevo', async () => {
      const existing = makeExistingBanner({
        imageUrl: 'https://res.cloudinary.com/.../old-banner.jpg',
        targetUrl: 'https://old-url.com',
        updatedBy: 'admin-old',
      });
      bannerRepository.findOne.mockResolvedValue(existing);

      await service.confirmBannerUpload('admin-2', validDto);

      // No debe llamar a create() porque ya existe la fila
      expect(bannerRepository.create).not.toHaveBeenCalled();
      expect(bannerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          imageUrl: validDto.secure_url, // reemplazado
          targetUrl: validDto.targetUrl, // reemplazado
          updatedBy: 'admin-2', // reemplazado
        }),
      );
    });

    it('actualiza updatedBy con el admin que realiza el cambio', async () => {
      bannerRepository.findOne.mockResolvedValue(
        makeExistingBanner({ updatedBy: 'admin-old' }),
      );

      await service.confirmBannerUpload('admin-nuevo', validDto);

      expect(bannerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: 'admin-nuevo' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // removeBanner
  // ═══════════════════════════════════════════════════════════════════════

  describe('removeBanner', () => {
    it('elimina el registro con id=1', async () => {
      const result = await service.removeBanner();

      expect(bannerRepository.delete).toHaveBeenCalledWith({ id: 1 });
      expect(result.message).toContain('eliminado');
    });

    it('es idempotente: no lanza error si ya no existía ningún banner', async () => {
      bannerRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeBanner()).resolves.toEqual(
        expect.objectContaining({ message: expect.any(String) as string }),
      );
    });
  });
});
