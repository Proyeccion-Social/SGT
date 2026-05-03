import { Module } from '@nestjs/common';
import { CloudinaryService } from './services/cloudinary.service';

@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
