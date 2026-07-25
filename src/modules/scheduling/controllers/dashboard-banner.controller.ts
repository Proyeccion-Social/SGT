import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { DashboardBannerService } from '../services/dashboard-banner.service';
import { ConfirmBannerUploadDto } from '../dto/confirm-banner-upload-dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('dashboard/banner')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class DashboardBannerController {
  constructor(private readonly bannerService: DashboardBannerService) {}

  // =====================================================
  // GET /api/dashboard/banner
  // Cualquier usuario autenticado (STUDENT, TUTOR, ADMIN) puede verlo
  // =====================================================
  @Get()
  @Roles(UserRole.STUDENT, UserRole.TUTOR, UserRole.ADMIN)
  async getBanner() {
    const banner = await this.bannerService.getActiveBanner();
    return {
      success: true,
      data: banner, // null si no hay banner activo — el frontend lo maneja
    };
  }

  // =====================================================
  // GET /api/dashboard/banner/upload-signature
  // Solo ADMIN — obtiene los parámetros firmados para subir a Cloudinary
  // =====================================================
  @Get('upload-signature')
  @Roles(UserRole.ADMIN)
  getUploadSignature() {
    return this.bannerService.getUploadSignature();
  }

  // =====================================================
  // POST /api/dashboard/banner/confirm
  // Solo ADMIN — confirma la subida y persiste imageUrl + targetUrl
  // =====================================================
  @Post('confirm')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async confirmUpload(
    @CurrentUser() user: User,
    @Body() dto: ConfirmBannerUploadDto,
  ) {
    return this.bannerService.confirmBannerUpload(user.idUser, dto);
  }

  // =====================================================
  // DELETE /api/dashboard/banner
  // Solo ADMIN — quita el banner sin necesidad de deploy
  // =====================================================
  @Delete()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeBanner() {
    return this.bannerService.removeBanner();
  }
}
