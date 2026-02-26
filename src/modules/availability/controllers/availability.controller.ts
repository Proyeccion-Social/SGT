import {
  Controller,
  Get,
  Post,
  UseGuards,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole, User } from '../../users/entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { FilterTutorsDto } from '../dto/filter-tutors.dto';
import { ManageSlotDto } from '../dto/manage-slot.dto';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { UpdateSlotDto } from '../dto/update-slot.dto';
import { DeleteSlotDto } from '../dto/delete-slot.dto';
import { SlotAction } from '../enums/slot-action.enum';
import { SubjectsService } from 'src/modules/subjects/services/subjects.service';
import { TutorService } from 'src/modules/tutor/services/tutor.service';
import { AvailabilityService } from '../services/availability.service';
import { GetAvailabilityQueryDto } from '../dto/GetAvailabilityQueryDto';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly tutorService: TutorService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get('subjects/:subjectId/tutors')
  @UseGuards(JwtAuthGuard)
  async getTutorsBySubject(
    @Param('subjectId') subjectId: string,
    @Query() filters: FilterTutorsDto,
  ) {
    //====================================================
    // GET /api/v1/availability/subjects/:subjectId/tutors
    // RF-14: Visualizar tutores por materia (Código o Nombre)
    //====================================================

    let subject;

    // 2. Obtener tutores usando el TutorService (que soporta Nombre parcial)
    const tutors = await this.tutorService.findTutorsBySubject(subjectId);

    return {
      success: true,
      subject: subject
        ? {
            id: subject.idSubject,
            name: subject.name,
          }
        : { name: subjectId }, // Si buscamos por nombre, devolver el término
      data: tutors,
      total: tutors.length,
    };
  }

  /**
   * POST /api/v1/availability/tutor/slots
   * RF-15: Gestionar disponibilidad del tutor (CREATE, UPDATE, DELETE)
   * Solo accesible para usuarios con rol TUTOR
   */
  @Post('tutor/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  async manageSlot(
    @CurrentUser() user: User,
    @Body() manageSlotDto: ManageSlotDto,
  ) {
    const tutorId = user.idUser;

    // Enrutar según la acción solicitada
    switch (manageSlotDto.action) {
      case SlotAction.CREATE:
        const createData = manageSlotDto.data as CreateSlotDto;
        if (!createData || !createData.dayOfWeek || !createData.startTime || !createData.modality) {
          throw new BadRequestException(
            'Para CREATE se requieren: dayOfWeek, startTime, modality',
          );
        }
        const createdSlot = await this.availabilityService.createSlot(
          tutorId,
          createData,
        );
        return {
          statusCode: HttpStatus.CREATED,
          message: 'Franja de disponibilidad creada exitosamente',
          slot: createdSlot,
        };

      case SlotAction.UPDATE:
        const updateData = manageSlotDto.data as UpdateSlotDto;
        if (!updateData || !updateData.slotId) {
          throw new BadRequestException('Para UPDATE se requiere: slotId');
        }
        const updatedSlot = await this.availabilityService.updateSlot(
          tutorId,
          updateData,
        );
        return {
          statusCode: HttpStatus.OK,
          message: 'Franja de disponibilidad actualizada exitosamente',
          slot: updatedSlot,
        };

      case SlotAction.DELETE:
        const deleteData = manageSlotDto.data as DeleteSlotDto;
        if (!deleteData || !deleteData.slotId) {
          throw new BadRequestException('Para DELETE se requiere: slotId');
        }
        const result = await this.availabilityService.deleteSlot(
          tutorId,
          deleteData,
        );
        return {
          statusCode: HttpStatus.OK,
          ...result,
        };

      default:
        throw new BadRequestException('Acción no válida');
    }
  }

  /**
   * GET /api/availability/tutors/:tutorId
   * RF16:Ver disponibilidad de un tutor específico (público/estudiantes)
   * 
   * Query params opcionales:
   * - onlyAvailable: true/false (solo slots sin reserva)
   * - onlyFuture: true/false (solo slots futuros)
   * - modality: PRES/VIRT (filtrar por modalidad)
   */
  @Get('tutors/:tutorId/slots')
  async getTutorAvailability(
    @Param('tutorId', ParseUUIDPipe) tutorId: string,
    @Query() query: GetAvailabilityQueryDto,
  ) {
    return await this.availabilityService.getTutorAvailability(tutorId, {
      onlyAvailable: query.onlyAvailable,
      onlyFuture: query.onlyFuture,
      modality: query.modality,
    });
  }

  /**
   * GET /api/availability/tutors
   * Listar todos los tutores con disponibilidad (público/estudiantes)
   * Útil para mostrar un directorio de tutores disponibles
   */
  @Get('tutors/slots')
  async getAllAvailableTutors(@Query() query: GetAvailabilityQueryDto) {
    return await this.availabilityService.getAllAvailableTutors({
      modality: query.modality,
      onlyAvailable: query.onlyAvailable,
    });
  }


}
