// src/modules/app-notifications/controllers/app-notifications.controller.ts

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AppNotificationsService } from '../services/app-notifications.service';

// ─────────────────────────────────────────────────────────────────────────────
// Query params para listar notificaciones
// ─────────────────────────────────────────────────────────────────────────────

class ListNotificationsQuery {
  page?: number;
  limit?: number;
  onlyUnread?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
//
// Solo requiere JWT válido — cualquier usuario autenticado puede consultar
// y gestionar SUS propias notificaciones. La validación de pertenencia
// la hace el servicio (markAsRead lanza ForbiddenException si no coincide).
// ─────────────────────────────────────────────────────────────────────────────

@Controller('api/v1/notifications/inbox')
@UseGuards(JwtAuthGuard)
export class AppNotificationsController {
  constructor(
    private readonly appNotificationsService: AppNotificationsService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/v1/notifications/inbox
  //
  // Lista las notificaciones del usuario autenticado, más recientes primero.
  // El campo `meta.unreadCount` sirve para el badge del panel.
  //
  // Query params:
  //   page       (default: 1)
  //   limit      (default: 20)
  //   onlyUnread (default: false) — filtrar solo las no leídas
  // ───────────────────────────────────────────────────────────────────────────

  @Get()
  async listMyNotifications(
    @CurrentUser() user: User,
    @Query() query: ListNotificationsQuery,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const onlyUnread =
      query.onlyUnread === true || (query.onlyUnread as any) === 'true';

    return this.appNotificationsService.findByUser(
      user.idUser,
      page,
      limit,
      onlyUnread,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/notifications/inbox/:id/read
  //
  // Marca una notificación específica como leída.
  // Devuelve 404 si no existe, 403 si no pertenece al usuario.
  // ───────────────────────────────────────────────────────────────────────────

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.appNotificationsService.markAsRead(id, user.idUser);
    return { success: true, message: 'Notificación marcada como leída' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/notifications/inbox/read-all
  //
  // Marca todas las notificaciones no leídas del usuario como leídas.
  // Útil para el botón "Marcar todas como leídas" del panel.
  // ───────────────────────────────────────────────────────────────────────────

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: User) {
    const result = await this.appNotificationsService.markAllAsRead(
      user.idUser,
    );
    return {
      success: true,
      message: `${result.updated} notificaciones marcadas como leídas`,
      updated: result.updated,
    };
  }
}
