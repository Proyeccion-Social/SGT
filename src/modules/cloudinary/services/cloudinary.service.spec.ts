import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          CLOUDINARY_NAME: 'sgt-cloud',
          CLOUDINARY_API_KEY: 'api-key',
          CLOUDINARY_API_SECRET: 'api-secret',
        };

        return values[key];
      }),
    };

    service = new CloudinaryService(configService as unknown as ConfigService);
  });

  it('should throw when cloudinary configuration is missing', () => {
    configService.getOrThrow.mockImplementation(() => {
      throw new Error('missing');
    });

    expect(() => new CloudinaryService(configService as unknown as ConfigService)).toThrow(
      InternalServerErrorException,
    );
  });

  it('should generate a signed payload for uploads', () => {
    const originalNow = Date.now;
    Date.now = jest.fn(() => 1710000000123);

    const result = service.generateUploadSignature('tutors/tutor-1', 'tutors/tutor-1/avatar');

    expect(result).toEqual({
      timestamp: '1710000000',
      signature: crypto.createHash('sha1').update('timestamp=1710000000api-secret').digest('hex'),
      api_key: 'api-key',
      cloud_name: 'sgt-cloud',
      folder: 'tutors/tutor-1',
      public_id: 'tutors/tutor-1/avatar',
    });

    Date.now = originalNow;
  });

  it('should reject missing folder or public_id', () => {
    expect(() => service.generateUploadSignature('', 'tutors/tutor-1/avatar')).toThrow(
      BadRequestException,
    );

    expect(() => service.generateUploadSignature('tutors/tutor-1', '')).toThrow(
      BadRequestException,
    );
  });

  it('should validate only cloudinary urls for the configured cloud', () => {
    expect(
      service.isValidCloudinaryUrl('https://res.cloudinary.com/sgt-cloud/image/upload/v1/avatar.jpg'),
    ).toBe(true);
    expect(service.isValidCloudinaryUrl('https://example.com/avatar.jpg')).toBe(false);
    expect(service.isValidCloudinaryUrl('')).toBe(false);
  });

  it('should return the configured cloud name', () => {
    expect(service.getCloudName()).toBe('sgt-cloud');
  });
});