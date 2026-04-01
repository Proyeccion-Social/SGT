// src/auth/controllers/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit-log.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RecoverPasswordDto } from '../dto/recover-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ConfirmEmailDto } from '../dto/confirm-email.dto';
import { CheckEmailDto } from '../dto/check-email.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
  ) {}

  // =====================================================
  // POST /api/v1/auth/register
  // Registrar estudiante
  // =====================================================

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // =====================================================
  // POST /api/v1/auth/confirm-email
  // Confirmar correo electrónico
  // =====================================================
  @Public()
  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  async confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.authService.confirmEmail(dto.token);
  }

  // =====================================================
  // POST /api/v1/auth/check-email
  // Verificar si existe email en BD
  // =====================================================
  @Public()
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body() dto: CheckEmailDto) {
    const exists = await this.authService.checkEmailExists(dto.email);
    return { exists };
  }

  // =====================================================
  // POST /api/v1/auth/login
  // Iniciar sesión
  // =====================================================
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';
    const userAgent = request.headers['user-agent'] || 'Unknown';

    return this.authService.login(dto, ip, userAgent);
  }

  // =====================================================
  // POST /api/v1/auth/refresh
  // Refrescar access token
  // =====================================================
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';

    return this.authService.refresh(dto.refreshToken, ip);
  }

  // =====================================================
  // POST /api/v1/auth/logout
  // Cerrar sesión
  // =====================================================
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
  ) {
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';

    return this.authService.logout(user.idUser, dto.refreshToken, ip);
  }

  // =====================================================
  // POST /api/v1/auth/password/recover
  // Solicitar recuperación de contraseña
  // =====================================================
  @Public()
  @Post('password/recover')
  @HttpCode(HttpStatus.OK)
  async recoverPassword(@Body() dto: RecoverPasswordDto) {
    return this.authService.recoverPassword(dto.email);
  }

  // =====================================================
  // POST /api/v1/auth/password/reset
  // Restablecer contraseña con token
  // =====================================================
  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Query('token') token: string,
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';

    return this.authService.resetPassword(
      token,
      dto.password,
      dto.confirmPassword,
      ip,
    );
  }

  // =====================================================
  // POST /api/v1/auth/password/change
  // Cambiar contraseña (usuario autenticado)
  // =====================================================
  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';
    const userAgent = request.headers['user-agent'] || 'Unknown';

    return this.authService.changePassword(user.idUser, dto, ip, userAgent);
  }

  // =====================================================
  // GET /api/v1/auth/sessions/current
  // Consultar sesión actual
  // =====================================================
  @Get('sessions/current')
  @UseGuards(JwtAuthGuard)
  async getCurrentSession(@CurrentUser() user: User) {
    return this.authService.getCurrentSession(user.idUser);
  }

  // =====================================================
  // GET /api/v1/auth/sessions/audit-logs
  // Auditoría de accesos (solo ADMIN)
  // =====================================================
  @Get('sessions/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('result') result?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};

    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (result) filters.result = result;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (ipAddress) filters.ipAddress = ipAddress;
    if (page) filters.page = parseInt(page);
    if (limit) filters.limit = parseInt(limit);

    const { data, total } = await this.auditService.getAuditLogs(filters);

    return {
      data,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    };
  }

  // =====================================================
  //GET api/v1/auth/me
  //Valida el accessToken y retorna la info del usuario actual
  // =====================================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: User) {
    return await this.authService.getCurrentUser(user.idUser);
  }

  // =====================================================
  // GET /api/v1/auth/sessions/audit-logs/export
  // Exportar auditoría a CSV (solo ADMIN)
  // =====================================================
  @Get('sessions/audit-logs/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async exportAuditLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    const filters: any = {};

    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    if (userId) filters.userId = userId;

    const csv = await this.auditService.exportToCSV(filters);

    return {
      filename: `audit_logs_${new Date().toISOString()}.csv`,
      content: csv,
    };
  }
}
