// src/modules/session-execution/services/attendance.service.ts
 
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../scheduling/entities/session.entity';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';
import { StudentParticipateSession } from '../../scheduling/entities/student-participate-session.entity';
import { ParticipationStatus } from '../../scheduling/enums/participation-status.enum';
import { RegisterStudentAttendanceDto } from '../dto/register-student-attendance.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
 
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Session, 'local')
    private readonly sessionRepository: Repository<Session>,
 
    @InjectRepository(StudentParticipateSession, 'local')
    private readonly studentParticipateSessionRepository: Repository<StudentParticipateSession>,
 
    private readonly notificationsService: NotificationsService,
  ) {}
 
  async registerStudentAttendance(
    sessionId: string,
    tutorId: string,
    dto: RegisterStudentAttendanceDto,
  ) {
    const attendanceConflictDescription =
      'No se puede registrar asistencia (sesion no confirmada, fecha invalida, o estado invalido)';
 
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
    });
 
    if (!session) {
      throw new NotFoundException({
        errorCode: 'RESOURCE_02',
        message: 'Sesion no encontrada',
      });
    }
 
    if (session.idTutor !== tutorId) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Esta sesion no pertenece al tutor autenticado',
      });
    }
 
    if (session.status !== SessionStatus.SCHEDULED || !session.tutorConfirmed) {
      throw new ConflictException({
        errorCode: 'BUSINESS_09',
        message: 'Conflicto de asistencia',
        description: attendanceConflictDescription,
      });
    }
 
    const today = new Date();
    today.setHours(0, 0, 0, 0);
 
    const scheduledDate = new Date(session.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);
 
    if (scheduledDate.getTime() > today.getTime()) {
      throw new ConflictException({
        errorCode: 'BUSINESS_09',
        message: 'Conflicto de asistencia',
        description: attendanceConflictDescription,
      });
    }
 
    const ids = dto.attendances.map((attendance) => attendance.studentId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new ConflictException({
        errorCode: 'BUSINESS_09',
        message: 'Conflicto de asistencia',
        description: attendanceConflictDescription,
      });
    }
 
    for (const attendance of dto.attendances) {
      if (attendance.status === ParticipationStatus.LATE && !attendance.arrivalTime) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_01',
          message: 'Datos de entrada invalidos',
        });
      }
 
      if (
        attendance.status === ParticipationStatus.ABSENT &&
        attendance.arrivalTime
      ) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_01',
          message: 'Datos de entrada invalidos',
        });
      }
    }
 
    // Cargamos relaciones student.user aquí para tener los nombres
    // disponibles tanto para el return como para las notificaciones.
    const participations = await this.studentParticipateSessionRepository.find({
      where: { idSession: sessionId },
      relations: ['student', 'student.user'],
    });
 
    const participantsById = new Map(
      participations.map((participation) => [participation.idStudent, participation]),
    );
 
    const allParticipants = dto.attendances.every((attendance) =>
      participantsById.has(attendance.studentId),
    );
 
    if (!allParticipants) {
      throw new ConflictException({
        errorCode: 'BUSINESS_09',
        message: 'Conflicto de asistencia',
        description: attendanceConflictDescription,
      });
    }
 
    const recordedAt = new Date().toISOString();
 
    const updatedParticipations = dto.attendances.map((attendance) => {
      const participation = participantsById.get(attendance.studentId)!;
      participation.status = attendance.status;
      participation.arrivalTime = attendance.arrivalTime
        ? new Date(attendance.arrivalTime)
        : null;
      return participation;
    });
 
    await this.studentParticipateSessionRepository.save(updatedParticipations);
 
    // ─── Notificar a los estudiantes AUSENTES ──────────────────────────────────
    //
    // Filtramos los que quedaron con status ABSENT tras el save.
    // Necesitamos tutor y materia para el email, por lo que hacemos una
    // consulta adicional con esas relaciones. Se dispara sin bloquear el return.
    const absentParticipations = updatedParticipations.filter(
      (p) => p.status === ParticipationStatus.ABSENT,
    );
 
    if (absentParticipations.length > 0) {
      // Cargamos tutor y subject; session ya está en memoria pero sin relaciones.
      this.sessionRepository
        .findOne({
          where: { idSession: sessionId },
          relations: ['tutor', 'tutor.user', 'subject'],
        })
        .then((sessionWithRelations) => {
          const tutorName   = sessionWithRelations?.tutor?.user?.name ?? 'Tutor';
          const subjectName = sessionWithRelations?.subject?.name ?? 'Materia';
 
          for (const participation of absentParticipations) {
            this.notificationsService
              .sendSessionAbsentNotification(
                sessionId,
                participation.idStudent,
                participation.student?.user?.name ?? 'Estudiante',
                tutorName,
                subjectName,
                session.scheduledDate,
                session.startTime,
              )
              .catch((err) => {
                console.error(
                  `[AttendanceService] Error al notificar inasistencia — estudiante ${participation.idStudent}: ${err.message}`,
                );
              });
          }
        })
        .catch((err) => {
          console.error(
            `[AttendanceService] Error al cargar relaciones para notificaciones de inasistencia: ${err.message}`,
          );
        });
    }
 
    return {
      message: 'Asistencia registrada exitosamente',
      sessionId,
      attendances: updatedParticipations.map((participation) => ({
        studentId:   participation.idStudent,
        studentName: participation.student?.user?.name ?? 'Estudiante',
        status:      participation.status,
        arrivalTime: participation.arrivalTime
          ? participation.arrivalTime.toISOString()
          : null,
        recordedAt,
      })),
      recordedAt,
    };
  }
 
  async registerCompletedSession(sessionId: string, tutorId: string) {
    const session = await this.sessionRepository.findOne({
      where: { idSession: sessionId },
    });
 
    if (!session) {
      throw new NotFoundException({
        errorCode: 'RESOURCE_02',
        message: 'Sesion no encontrada',
      });
    }
 
    if (session.idTutor !== tutorId) {
      throw new ForbiddenException({
        errorCode: 'PERMISSION_01',
        message: 'Esta sesion no pertenece al tutor autenticado',
      });
    }
 
    if (session.status === SessionStatus.COMPLETED) {
      throw new ConflictException({
        errorCode: 'BUSINESS_10',
        message: 'La sesion ya esta marcada como completada',
      });
    }
 
    if (session.status !== SessionStatus.SCHEDULED || !session.tutorConfirmed) {
      throw new ConflictException({
        errorCode: 'BUSINESS_10',
        message: 'Solo se pueden completar sesiones confirmadas',
      });
    }
 
    const today = new Date();
    today.setHours(0, 0, 0, 0);
 
    const scheduledDate = new Date(session.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);
 
    if (scheduledDate.getTime() > today.getTime()) {
      throw new ConflictException({
        errorCode: 'BUSINESS_10',
        message: 'No se puede completar sesiones futuras',
      });
    }
 
    const participations = await this.studentParticipateSessionRepository.find({
      where: { idSession: sessionId },
      // Cargamos student.user para tener los nombres disponibles
      // tanto para la validación de asistencia como para las notificaciones.
      relations: ['student', 'student.user'],
    });
 
    const attendanceStatuses = new Set<ParticipationStatus>([
      ParticipationStatus.ATTENDED,
      ParticipationStatus.ABSENT,
      ParticipationStatus.LATE,
    ]);
 
    const attendanceRecorded =
      participations.length > 0 &&
      participations.every((participation) =>
        attendanceStatuses.has(participation.status),
      );
 
    if (!attendanceRecorded) {
      throw new ConflictException({
        errorCode: 'BUSINESS_10',
        message: 'Debe registrar asistencia antes de completar la sesion',
      });
    }
 
    session.status = SessionStatus.COMPLETED;
    const completedAt = new Date();
    await this.sessionRepository.save(session);
 
    // ─── Notificar a los estudiantes que ASISTIERON para que evalúen ───────────
    //
    // Solo ATTENDED y LATE pueden evaluar — los ABSENT no asistieron.
    // Se carga sessionWithRelations para tener tutor y materia en el template.
    // El disparo es asíncrono para no bloquear el return.
    const attendingParticipations = participations.filter(
      (p) =>
        p.status === ParticipationStatus.ATTENDED ||
        p.status === ParticipationStatus.LATE,
    );
 
    if (attendingParticipations.length > 0) {
      this.sessionRepository
        .findOne({
          where: { idSession: sessionId },
          relations: ['tutor', 'tutor.user', 'subject'],
        })
        .then((sessionWithRelations) => {
          // Shape mínimo compatible con sendEvaluationPendingReminder(session: any)
          const sessionLike = {
            id:            sessionId,
            scheduledDate: session.scheduledDate,
            startTime:     session.startTime,
            title:         session.title,
            tutor: {
              id:   session.idTutor,
              name: sessionWithRelations?.tutor?.user?.name ?? 'Tutor',
            },
            subject: {
              name: sessionWithRelations?.subject?.name ?? 'Materia',
            },
            participants: attendingParticipations.map((p) => ({
              id:   p.idStudent,
              name: p.student?.user?.name ?? 'Estudiante',
            })),
          };
 
          for (const participation of attendingParticipations) {
            this.notificationsService
              .sendEvaluationPendingReminder(
                sessionLike,
                participation.idStudent,
                false, // isReminder=false: primera notificación, no el recordatorio de 24h
              )
              .catch((err) => {
                console.error(
                  `[AttendanceService] Error al notificar evaluación pendiente — estudiante ${participation.idStudent}: ${err.message}`,
                );
              });
          }
        })
        .catch((err) => {
          console.error(
            `[AttendanceService] Error al cargar relaciones para notificaciones de evaluación: ${err.message}`,
          );
        });
    }
 
    return {
      message:
        'Sesion completada exitosamente. Los estudiantes han sido notificados para evaluar',
      sessionId:       session.idSession,
      status:          session.status,
      completedAt:     completedAt.toISOString(),
      duration:        this.calculateDurationHours(session.startTime, session.endTime),
      // El conteo ahora refleja solo los que asistieron (quienes recibirán el email)
      studentsNotified: attendingParticipations.length,
    };
  }
 
  private calculateDurationHours(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute]     = endTime.split(':').map(Number);
 
    const durationMinutes =
      endHour * 60 + endMinute - (startHour * 60 + startMinute);
 
    return durationMinutes <= 0 ? 0 : Number((durationMinutes / 60).toFixed(2));
  }
}