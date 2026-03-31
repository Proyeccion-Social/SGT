import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExternalConfigService } from '../services/external-config.service';
import { UpdateConfigDto } from '../dto/update-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExternalConfigController {
  constructor(private readonly externalConfigService: ExternalConfigService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getConfig() {
    return this.externalConfigService.getConfig();
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.externalConfigService.updateConfig(dto);
  }
}
