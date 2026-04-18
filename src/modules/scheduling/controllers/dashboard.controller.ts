// src/scheduling/controllers/dashboard.controller.ts

import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { User, UserRole} from '../../users/entities/user.entity';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/dashboard/student
   * Dashboard del estudiante actual
   */
  @Get('student')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async getStudentDashboard(@CurrentUser() user: User) {
    const studentId = user.idUser;
    return await this.dashboardService.getStudentDashboard(studentId);
  }

  /**
   * GET /api/dashboard/tutor
   * Dashboard del tutor actual
   */
  @Get('tutor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  async getTutorDashboard(@CurrentUser() user: User) {
    const tutorId = user.idUser;
    return await this.dashboardService.getTutorDashboard(tutorId);
  }
}