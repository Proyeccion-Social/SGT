import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Question, QuestionAspect } from '../entities/question.entity';
import { Answer } from '../entities/answer.entity';
import { Session } from '../../scheduling/entities/session.entity';
import { SessionStatus } from '../../scheduling/enums/session-status.enum';
import { StudentParticipateSession } from '../../scheduling/entities/student-participate-session.entity';
import { SendSessionEvaluationDto } from '../dto/send-session-evaluation.dto';
import { User, UserRole } from '../../users/entities/user.entity';
import { GetSessionEvaluationResponseDto } from '../dto/get-session-evaluation.dto';

@Injectable()
export class EvaluationService {
	constructor(
		@InjectRepository(Question, 'local')
		private readonly questionRepository: Repository<Question>,
		@InjectRepository(Answer, 'local')
		private readonly answerRepository: Repository<Answer>,
		@InjectRepository(Session, 'local')
		private readonly sessionRepository: Repository<Session>,
		@InjectRepository(StudentParticipateSession, 'local')
		private readonly participationRepository: Repository<StudentParticipateSession>,
		@InjectRepository(User, 'local')
		private readonly userRepository: Repository<User>,
	) {}

	async getEvaluationQuestionnaire() {
		const version = '1.0';
		const questions = await this.questionRepository.find({
			where: {
				questionnaireVersion: version,
				isActive: true,
			},
			order: {
				displayOrder: 'ASC',
			},
		});

		return {
			questionnaire: {
				id: 'evaluation-questionnaire-v1',
				version,
				questions: questions.map((question) => ({
					aspect: question.aspect,
					label: question.label,
					description: question.description,
					ratingScale: {
						min: question.minScore,
						max: question.maxScore,
					},
					required: question.required,
				})),
				comments: {
					enabled: true,
					required: false,
					maxLength: 500,
					label: 'Comentarios adicionales (opcional)',
					placeholder:
						'Comparte cualquier comentario adicional sobre la sesion...',
				},
				overallRating: {
					enabled: true,
					required: false,
					calculation:
						'Promedio automatico de aspectos o calificacion independiente',
				},
			},
		};
	}

	async sendSessionEvaluation(
		sessionId: string,
		studentId: string,
		dto: SendSessionEvaluationDto,
	) {
		const session = await this.sessionRepository.findOne({
			where: { idSession: sessionId },
		});

		if (!session) {
			throw new NotFoundException({
				errorCode: 'RESOURCE_02',
				message: 'Sesion no encontrada',
			});
		}

		const participation = await this.participationRepository.findOne({
			where: { idSession: sessionId, idStudent: studentId },
		});

		if (!participation) {
			throw new ForbiddenException({
				errorCode: 'PERMISSION_01',
				message: 'No participaste en esta sesion',
			});
		}

		const conflictPayload = {
			errorCode: 'RESOURCE_04',
			message: 'Conflicto de estado',
			description: 'Ya evaluaste esta sesion o la sesion no esta completada',
		};

		if (session.status !== SessionStatus.COMPLETED) {
			throw new ConflictException(conflictPayload);
		}

		const alreadyEvaluated = await this.answerRepository.exists({
			where: { idSession: sessionId, idStudent: studentId },
		});

		if (alreadyEvaluated) {
			throw new ConflictException(conflictPayload);
		}

		const sessionDate = new Date(session.scheduledDate);
		sessionDate.setHours(23, 59, 59, 999);
		const deadline = new Date(sessionDate);
		deadline.setDate(deadline.getDate() + 7);

		if (new Date() > deadline) {
			throw new ConflictException(conflictPayload);
		}

		const questionnaireVersion = '1.0';
		const questions = await this.questionRepository.find({
			where: {
				questionnaireVersion,
				isActive: true,
			},
		});

		const ratingsByAspect: Record<QuestionAspect, number> = {
			[QuestionAspect.CLARITY]: dto.ratings.clarity,
			[QuestionAspect.PATIENCE]: dto.ratings.patience,
			[QuestionAspect.PUNCTUALITY]: dto.ratings.punctuality,
			[QuestionAspect.KNOWLEDGE]: dto.ratings.knowledge,
		};

		const evaluatedAt = new Date();
		const evaluationId = randomUUID();
		const answers = questions.map((question) => {
			const score = ratingsByAspect[question.aspect];
			return this.answerRepository.create({
				idQuestion: question.idQuestion,
				idSession: sessionId,
				idStudent: studentId,
				evaluationId,
				score,
				evaluatedAt,
				questionnaireVersion,
			});
		});

		await this.answerRepository.save(answers);

		participation.comment = dto.comments ?? '';
		await this.participationRepository.save(participation);

		const computedOverallRating =
			(dto.ratings.clarity +
				dto.ratings.patience +
				dto.ratings.punctuality +
				dto.ratings.knowledge) /
			4;

		return {
			message:
				'Evaluacion enviada exitosamente. Gracias por tu retroalimentacion',
			evaluationId,
			sessionId,
			studentId,
			tutorId: session.idTutor,
			ratings: dto.ratings,
			overallRating: dto.overallRating ?? Number(computedOverallRating.toFixed(2)),
			comments: dto.comments ?? null,
			evaluatedAt: evaluatedAt.toISOString(),
		};
	}

	async getSessionEvaluation(
		sessionId: string,
		userId: string,
		userRole: UserRole,
		studentId?: string,
	): Promise<GetSessionEvaluationResponseDto> {
		const session = await this.sessionRepository.findOne({
			where: { idSession: sessionId },
			relations: ['tutor', 'tutor.user', 'subject'],
		});

		if (!session) {
			throw new NotFoundException({
				errorCode: 'RESOURCE_07',
				message: 'Evaluación no encontrada',
				description: 'No existe evaluación para esta sesión o no tiene permisos para verla',
			});
		}

		if (session.status !== SessionStatus.COMPLETED) {
			throw new ConflictException({
				errorCode: 'RESOURCE_07',
				message: 'La sesión debe estar completada para ver su evaluación',
			});
		}

		// Validar permisos
		if (userRole === UserRole.STUDENT) {
			// Estudiante solo puede ver su propia evaluación
			const hasEvaluation = await this.answerRepository.count({
				where: { idSession: sessionId, idStudent: userId },
			});

			if (hasEvaluation === 0) {
				throw new ForbiddenException({
					errorCode: 'PERMISSION_01',
					message: 'No tiene permisos para ver esta evaluación',
				});
			}
		} else if (userRole === UserRole.TUTOR) {
			// Tutor solo puede ver evaluaciones de sus sesiones
			if (session.idTutor !== userId) {
				throw new ForbiddenException({
					errorCode: 'PERMISSION_01',
					message: 'No tiene permisos para ver esta evaluación',
				});
			}
		}
		// ADMIN puede ver todo, sin validación adicional

		// Obtener todas las respuestas de la sesión con preguntas, agrupadas eficientemente
		const answers = await this.answerRepository
			.createQueryBuilder('answer')
			.leftJoinAndSelect('answer.question', 'question')
			.leftJoinAndSelect('answer.studentParticipateSession', 'participation')
			.leftJoinAndSelect('answer.studentParticipateSession.student', 'student')
			.leftJoinAndSelect('student.user', 'user')
			.where('answer.id_session = :sessionId', { sessionId })
			.orderBy('answer.id_student', 'ASC')
			.addOrderBy('question.aspect', 'ASC')
			.getMany();

		if (answers.length === 0) {
			throw new NotFoundException({
				errorCode: 'RESOURCE_07',
				message: 'Evaluación no encontrada',
				description: 'No existe evaluación para esta sesión o no tiene permisos para verla',
			});
		}

		// Agrupar respuestas por estudiante
		const evaluationsByStudent: Map<
			string,
			{
				evaluationId: string;
				studentId: string;
				studentName: string;
				ratings: Map<string, number>;
				comments?: string;
				evaluatedAt: Date;
			}
		> = new Map();

		for (const answer of answers) {
			const key = answer.idStudent;

			if (!evaluationsByStudent.has(key)) {
				const comments = answer.studentParticipateSession?.comment ?? undefined;
				const studentName = answer.studentParticipateSession?.student?.user?.name ?? 'Desconocido';

				evaluationsByStudent.set(key, {
					evaluationId: answer.evaluationId,
					studentId: answer.idStudent,
					studentName,
					ratings: new Map(),
					comments,
					evaluatedAt: answer.evaluatedAt,
				});
			}

			// Guardar score bajo el aspecto de la pregunta
			if (answer.question && answer.score !== null && answer.score !== undefined) {
				const evalData = evaluationsByStudent.get(key)!;
				evalData.ratings.set(answer.question.aspect, answer.score);
			}
		}

		// Construir array de evaluaciones y calcular promedios (con studentId guardado para filtrado)
		const evaluationDetails = Array.from(evaluationsByStudent.values()).map((evalData) => {
			const ratingValues = Array.from(evalData.ratings.values());
			const overallRating =
				ratingValues.length > 0
					? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
					: 0;

			return {
				evaluationId: evalData.evaluationId,
				studentId: evalData.studentId, // Guardar aquí para filtrado
				studentName: evalData.studentName,
				ratings: {
					clarity: evalData.ratings.get('CLARITY') || 0,
					patience: evalData.ratings.get('PATIENCE') || 0,
					punctuality: evalData.ratings.get('PUNCTUALITY') || 0,
					knowledge: evalData.ratings.get('KNOWLEDGE') || 0,
				},
				overallRating: Number(overallRating.toFixed(2)),
				comments: evalData.comments,
				evaluatedAt: evalData.evaluatedAt.toISOString(),
			};
		});

		// Filtrar por studentId si es especificado (TUTOR siempre ve todas sin filtro)
		const filteredEvaluations = studentId && userRole !== UserRole.TUTOR
			? evaluationDetails.filter((e) => e.studentId === studentId)
			: evaluationDetails;

		// Validar permisos de acceso a evaluaciones filtradas (solo para STUDENT)
		if (studentId && userRole === UserRole.STUDENT && filteredEvaluations.length === 0) {
			throw new ForbiddenException({
				errorCode: 'PERMISSION_01',
				message: 'No tiene permisos para ver esta evaluación',
			});
		}

		// Calcular promedio general ANTES de ocultar studentId
		const averageRating =
			filteredEvaluations.length > 0
				? Number(
						(
							filteredEvaluations.reduce((sum, e) => sum + e.overallRating, 0) /
							filteredEvaluations.length
						).toFixed(2),
				)
				: 0;

		// Aplicar anonimato para tutores (DESPUÉS de filtrado y cálculos)
		const finalEvaluations = filteredEvaluations.map((evaluation) => ({
			...evaluation,
			studentId: userRole === UserRole.TUTOR ? undefined : evaluation.studentId,
			studentName: userRole === UserRole.TUTOR ? undefined : evaluation.studentName,
		}));

		return {
			evaluationId: randomUUID(),
			sessionId,
			sessionDate: new Date(session.scheduledDate).toISOString().split('T')[0],
			tutorId: session.idTutor,
			tutorName: session.tutor?.user?.name || 'Desconocido',
			subjectName: session.subject?.name || 'Desconocido',
			evaluations: finalEvaluations,
			averageRating,
			totalEvaluations: finalEvaluations.length,
		};
	}
}

