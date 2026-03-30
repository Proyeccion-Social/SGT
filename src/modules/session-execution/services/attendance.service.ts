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
import {
	RegisterStudentAttendanceDto,
} from '../dto/register-student-attendance.dto';

@Injectable()
export class AttendanceService {
	constructor(
		@InjectRepository(Session, 'local')
		private readonly sessionRepository: Repository<Session>,
		@InjectRepository(StudentParticipateSession, 'local')
		private readonly studentParticipateSessionRepository: Repository<StudentParticipateSession>,
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
				description:
					'No se puede registrar asistencia (sesion no confirmada, fecha invalida, o estado invalido)',
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

		return {
			message: 'Asistencia registrada exitosamente',
			sessionId,
			attendances: updatedParticipations.map((participation) => {
				return {
					studentId: participation.idStudent,
					studentName: participation.student?.user?.name ?? 'Estudiante',
					status: participation.status,
					arrivalTime: participation.arrivalTime
						? participation.arrivalTime.toISOString()
						: null,
					recordedAt,
				};
			}),
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

		if (
			session.status !== SessionStatus.SCHEDULED ||
			!session.tutorConfirmed
		) {
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

		return {
			message:
				'Sesion completada exitosamente. Los estudiantes han sido notificados para evaluar',
			sessionId: session.idSession,
			status: session.status,
			completedAt: completedAt.toISOString(),
			duration: this.calculateDurationHours(session.startTime, session.endTime),
			studentsNotified: participations.length,
		};
	}

	private calculateDurationHours(startTime: string, endTime: string): number {
		const [startHour, startMinute] = startTime.split(':').map(Number);
		const [endHour, endMinute] = endTime.split(':').map(Number);

		const startTotalMinutes = startHour * 60 + startMinute;
		const endTotalMinutes = endHour * 60 + endMinute;

		const durationMinutes = endTotalMinutes - startTotalMinutes;

		if (durationMinutes <= 0) {
			return 0;
		}

		return Number((durationMinutes / 60).toFixed(2));
	}
}
