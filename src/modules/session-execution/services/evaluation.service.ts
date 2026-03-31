import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

	async getTutorEvaluations(
		tutorId: string,
		subjectId?: string,
		startDate?: string,
		endDate?: string,
		page: number = 1,
		limit: number = 20,
	) {
		// Verificar que el tutor existe
		const tutor = await this.userRepository.findOne({
			where: { idUser: tutorId },
		});

		if (!tutor) {
			throw new NotFoundException({
				errorCode: 'RESOURCE_02',
				message: 'Tutor no encontrado',
			});
		}

		// Validar rango de fechas si ambas están presentes
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			if (start > end) {
				throw new BadRequestException({
					errorCode: 'VALIDATION_01',
					message: 'Rango de fechas inválido',
					description: 'startDate debe ser menor o igual a endDate',
				});
			}
		}

		// Construir query base para obtener answers de sesiones del tutor
		let answerQuery = this.answerRepository
			.createQueryBuilder('answer')
			.leftJoinAndSelect('answer.question', 'question')
			.leftJoinAndSelect('answer.session', 'session')
			.leftJoinAndSelect('session.tutor', 'tutor')
			.leftJoinAndSelect('session.subject', 'subject')
			.leftJoinAndSelect('answer.studentParticipateSession', 'participation')
			.where('session.id_tutor = :tutorId', { tutorId })
			.andWhere('session.status = :status', { status: SessionStatus.COMPLETED });

		// Aplicar filtro de materia si existe
		if (subjectId) {
			answerQuery.andWhere('session.id_subject = :subjectId', { subjectId });
		}

		// Aplicar filtro de rango de fechas si existe
		if (startDate) {
			answerQuery.andWhere('DATE(session.scheduled_date) >= :startDate', {
				startDate: startDate,
			});
		}

		if (endDate) {
			answerQuery.andWhere('DATE(session.scheduled_date) <= :endDate', {
				endDate: endDate,
			});
		}

		// Obtener total de evaluaciones (por evaluationId único)
		const distinctAnswersQuery = answerQuery.clone();
		const allAnswers = await distinctAnswersQuery.getMany();

		const uniqueEvaluationIds = new Set(allAnswers.map((a) => a.evaluationId));
		const totalRecords = uniqueEvaluationIds.size;

		// Obtener respuestas ordenadas para paginación
		answerQuery
			.orderBy('answer.evaluated_at', 'DESC')
			.addOrderBy('answer.id_question', 'ASC');

		const answers = await answerQuery.getMany();

		// Agrupar por evaluationId con datos de sesión
		const sessionsByEval: Map<
			string,
			{
				sessionId: string;
				sessionDate: string;
				subjectName: string;
				evaluationId: string;
				ratings: Map<string, number>;
				comments?: string;
				evaluatedAt: Date;
			}
		> = new Map();

		const ratingsBySubject: Map<string, number[]> = new Map();
		const allRatings: number[] = [];
		const allAspectRatings: Map<string, number[]> = new Map();
		allAspectRatings.set('CLARITY', []);
		allAspectRatings.set('PATIENCE', []);
		allAspectRatings.set('PUNCTUALITY', []);
		allAspectRatings.set('KNOWLEDGE', []);

		// Información de sesiones (necesitamos cargarla por separado)
		const sessionIds = Array.from(new Set(answers.map((a) => a.idSession)));
		const sessions = sessionIds.length > 0
			? await this.sessionRepository.find({
					where: {
						idSession: In(sessionIds),
					},
					relations: ['subject'],
			  })
			: [];

		const sessionMap = new Map(sessions.map((s) => [s.idSession, s]));

		for (const answer of answers) {
			const evalKey = answer.evaluationId;
			const session = sessionMap.get(answer.idSession);

			if (!sessionsByEval.has(evalKey)) {
				sessionsByEval.set(evalKey, {
					sessionId: answer.idSession,
					sessionDate: session
						? new Date(session.scheduledDate).toISOString().split('T')[0]
						: 'Desconocido',
					subjectName: session?.subject?.name || 'Desconocido',
					evaluationId: evalKey,
					ratings: new Map(),
					comments: answer.studentParticipateSession?.comment,
					evaluatedAt: answer.evaluatedAt,
				});
			}

			// Guardar score bajo el aspecto de la pregunta
			if (answer.question && answer.score !== null && answer.score !== undefined) {
				const sessionData = sessionsByEval.get(evalKey)!;
				sessionData.ratings.set(answer.question.aspect, answer.score);

				// Acumular para cálculos de promedio
				allRatings.push(answer.score);
				allAspectRatings.get(answer.question.aspect)?.push(answer.score);

				// Acumular por materia
				const subjectKey = session?.subject?.name || 'Desconocido';
				if (!ratingsBySubject.has(subjectKey)) {
					ratingsBySubject.set(subjectKey, []);
				}
				ratingsBySubject.get(subjectKey)?.push(answer.score);
			}
		}

		// Construir array de evaluaciones con cálculos, aplicar paginación
		let evaluationsList = Array.from(sessionsByEval.values()).map((sessionData) => {
			const ratingValues = Array.from(sessionData.ratings.values());
			const overallRating =
				ratingValues.length > 0
					? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
					: 0;

			return {
				evaluationId: sessionData.evaluationId,
				sessionId: sessionData.sessionId,
				sessionDate: new Date(sessionData.sessionDate).toISOString().split('T')[0],
				subjectName: sessionData.subjectName,
				ratings: {
					clarity: sessionData.ratings.get('CLARITY') || 0,
					patience: sessionData.ratings.get('PATIENCE') || 0,
					punctuality: sessionData.ratings.get('PUNCTUALITY') || 0,
					knowledge: sessionData.ratings.get('KNOWLEDGE') || 0,
				},
				overallRating: Number(overallRating.toFixed(2)),
				comments: sessionData.comments,
				evaluatedAt: sessionData.evaluatedAt.toISOString(),
			};
		});

		// Aplicar paginación al array de evaluaciones finales
		const offset = (page - 1) * limit;
		const paginatedEvaluations = evaluationsList.slice(offset, offset + limit);

		// Calcular promedios SOLO del tutor (todos sus reviews)
		const averageRating =
			allRatings.length > 0
				? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
				: 0;

		const ratingsByAspect = {
			clarity: allAspectRatings.get('CLARITY')?.length
				? Number(
						(
							allAspectRatings
								.get('CLARITY')!
								.reduce((a, b) => a + b, 0) / allAspectRatings.get('CLARITY')!.length
						).toFixed(2),
				)
				: 0,
			patience: allAspectRatings.get('PATIENCE')?.length
				? Number(
						(
							allAspectRatings
								.get('PATIENCE')!
								.reduce((a, b) => a + b, 0) / allAspectRatings.get('PATIENCE')!.length
						).toFixed(2),
				)
				: 0,
			punctuality: allAspectRatings.get('PUNCTUALITY')?.length
				? Number(
						(
							allAspectRatings
								.get('PUNCTUALITY')!
								.reduce((a, b) => a + b, 0) / allAspectRatings.get('PUNCTUALITY')!.length
						).toFixed(2),
				)
				: 0,
			knowledge: allAspectRatings.get('KNOWLEDGE')?.length
				? Number(
						(
							allAspectRatings
								.get('KNOWLEDGE')!
								.reduce((a, b) => a + b, 0) / allAspectRatings.get('KNOWLEDGE')!.length
						).toFixed(2),
				)
				: 0,
		};

		// Calcular promedios por materia
		const averageBySubject: Record<string, number> = {};
		for (const [subject, ratings] of ratingsBySubject) {
			averageBySubject[subject] = Number(
				(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
			);
		}

		const totalPages = Math.ceil(totalRecords / limit);

		return {
			tutorId,
			tutorName: tutor.name,
			summary: {
				totalEvaluations: totalRecords,
				averageRating,
				ratingsByAspect,
				averageBySubject: Object.keys(averageBySubject).length > 0 ? averageBySubject : undefined,
			},
			evaluations: paginatedEvaluations,
			pagination: {
				page,
				limit,
				totalRecords,
				totalPages,
			},
			filters: {
				subjectId: subjectId || null,
				startDate: startDate || null,
				endDate: endDate || null,
			},
		};
	}

	async getTutorMetrics(
		tutorId: string,
		startDate?: string,
		endDate?: string,
		subjectId?: string,
	) {
		// Verificar que el tutor existe
		const tutor = await this.userRepository.findOne({
			where: { idUser: tutorId },
		});

		if (!tutor) {
			throw new NotFoundException({
				errorCode: 'RESOURCE_02',
				message: 'Tutor no encontrado',
			});
		}

		// Validar rango de fechas
		if (startDate && endDate) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			if (start > end) {
				throw new BadRequestException({
					errorCode: 'VALIDATION_01',
					message: 'Rango de fechas inválido',
					description: 'startDate debe ser menor o igual a endDate',
				});
			}
		}

		// Construir query para sesiones completadas
		let sessionQuery = this.sessionRepository
			.createQueryBuilder('session')
			.leftJoinAndSelect('session.subject', 'subject')
			.where('session.id_tutor = :tutorId', { tutorId })
			.andWhere('session.status = :status', { status: SessionStatus.COMPLETED });

		if (subjectId) {
			sessionQuery.andWhere('session.id_subject = :subjectId', { subjectId });
		}

		if (startDate) {
			sessionQuery.andWhere('DATE(session.scheduled_date) >= :startDate', {
				startDate,
			});
		}

		if (endDate) {
			sessionQuery.andWhere('DATE(session.scheduled_date) <= :endDate', {
				endDate,
			});
		}

		const sessions = await sessionQuery.getMany();

		if (sessions.length === 0) {
			// Retornar métricas vacías
			return {
				tutorId,
				tutorName: tutor.name,
				period: {
					startDate: startDate || null,
					endDate: endDate || null,
					description: startDate || endDate ? `Período: ${startDate} a ${endDate}` : 'Todas las métricas históricas',
				},
				ratingMetrics: {
					averageOverall: 0,
					totalEvaluations: 0,
					averageByAspect: {
						clarity: 0,
						patience: 0,
						punctuality: 0,
						knowledge: 0,
					},
					ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
				},
				sessionMetrics: {
					totalSessionsCompleted: 0,
					sessionsByType: { individual: 0, collaborative: 0 },
					sessionsByModality: { presencial: 0, virtual: 0 },
					sessionsBySubject: [],
				},
				attendanceMetrics: {
					attendanceRate: 0,
					presentCount: 0,
					absentCount: 0,
					lateCount: 0,
					noShowCount: 0,
				},
				temporalMetrics: {
					sessionsByMonth: [],
				},
				calculatedAt: new Date().toISOString(),
			};
		}

		const sessionIds = sessions.map((s) => s.idSession);

		// Obtener evaluaciones (answers) para rating metrics
		const answers = await this.answerRepository
			.createQueryBuilder('answer')
			.leftJoinAndSelect('answer.question', 'question')
			.where('answer.id_session IN (:...sessionIds)', { sessionIds })
			.getMany();

		// Obtener participaciones para attendance metrics
		const participations = await this.participationRepository
			.createQueryBuilder('participation')
			.where('participation.id_session IN (:...sessionIds)', { sessionIds })
			.getMany();

		// ─── Rating Metrics ───────────────────────────────────────────────────────

		const allRatings: number[] = [];
		const aspectRatings: Map<string, number[]> = new Map();
		aspectRatings.set('CLARITY', []);
		aspectRatings.set('PATIENCE', []);
		aspectRatings.set('PUNCTUALITY', []);
		aspectRatings.set('KNOWLEDGE', []);

		for (const answer of answers) {
			if (answer.score !== null && answer.score !== undefined) {
				allRatings.push(answer.score);
				aspectRatings.get(answer.question.aspect)?.push(answer.score);
			}
		}

		const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
		for (const rating of allRatings) {
			ratingDistribution[rating]++;
		}

		const averageOverall = allRatings.length > 0 
			? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
			: 0;

		const averageByAspect = {
			clarity: this.calculateAspectAverage(aspectRatings, 'CLARITY'),
			patience: this.calculateAspectAverage(aspectRatings, 'PATIENCE'),
			punctuality: this.calculateAspectAverage(aspectRatings, 'PUNCTUALITY'),
			knowledge: this.calculateAspectAverage(aspectRatings, 'KNOWLEDGE'),
		};

		// Get unique evaluation count (by evaluationId)
		const uniqueEvaluationIds = new Set(answers.map((a) => a.evaluationId));

		// ─── Session Metrics ──────────────────────────────────────────────────────

		const sessionsByType = { individual: 0, collaborative: 0 };
		const sessionsByModalityMap = { presencial: 0, virtual: 0 };
		const sessionsBySubjectMap: Map<string, { subjectName: string; count: number; subjectId: string }> = new Map();

		for (const session of sessions) {
			// Type counting (GROUP = collaborative)
			if (session.type === 'INDIVIDUAL') {
				sessionsByType.individual++;
			} else if (session.type === 'GROUP') {
				sessionsByType.collaborative++;
			}

			// Modality counting (from session.modality field)
			if (session.modality) {
				if (session.modality.toUpperCase() === 'PRESENCIAL' || session.modality.toUpperCase() === 'PRES') {
					sessionsByModalityMap.presencial++;
				} else if (session.modality.toUpperCase() === 'VIRTUAL' || session.modality.toUpperCase() === 'VIRT') {
					sessionsByModalityMap.virtual++;
				}
			}

			// Subject counting
			if (session.subject) {
				const subjectKey = session.subject.idSubject;
				if (!sessionsBySubjectMap.has(subjectKey)) {
					sessionsBySubjectMap.set(subjectKey, {
						subjectName: session.subject.name,
						count: 0,
						subjectId: session.subject.idSubject,
					});
				}
				const data = sessionsBySubjectMap.get(subjectKey)!;
				data.count++;
			}
		}

		const sessionsBySubject = Array.from(sessionsBySubjectMap.values()).map((item) => ({
			subjectId: item.subjectId,
			subjectName: item.subjectName,
			count: item.count,
		}));

		// ─── Attendance Metrics ───────────────────────────────────────────────────

		let presentCount = 0;
		let absentCount = 0;
		let lateCount = 0;
		let noShowCount = 0;

		for (const participation of participations) {
			if (participation.status === 'ATTENDED') {
				presentCount++;
			} else if (participation.status === 'ABSENT') {
				absentCount++;
			} else if (participation.status === 'LATE') {
				lateCount++;
			}
		}

		// noShowCount: participantes esperados - participantes con estado registrado
		// Los participantes esperados incluyen TODOS los StudentParticipateSession (individuales y grupales)
		const totalExpectedParticipants = participations.length;
		const totalWithStatus = presentCount + absentCount + lateCount;
		noShowCount = Math.max(0, totalExpectedParticipants - totalWithStatus);

		// attendanceRate: (participantes que comparecieron) / (total esperado) * 100
		// Cuenta ATTENDED + LATE (se presentaron) pero excluye ABSENT
		const totalPresent = presentCount + lateCount;
		const attendanceRate = totalExpectedParticipants > 0
			? Number(((totalPresent / totalExpectedParticipants) * 100).toFixed(2))
			: 0;

		// ─── Temporal Metrics ─────────────────────────────────────────────────────

		const sessionsByMonthMap: Map<string, { sessions: number; ratingSum: number; ratingCount: number }> = new Map();

		for (const session of sessions) {
			const monthKey = new Date(session.scheduledDate).toISOString().substring(0, 7); // YYYY-MM

			if (!sessionsByMonthMap.has(monthKey)) {
				sessionsByMonthMap.set(monthKey, { sessions: 0, ratingSum: 0, ratingCount: 0 });
			}

			const monthData = sessionsByMonthMap.get(monthKey)!;
			monthData.sessions++;

			// Add ratings for this session
			const sessionAnswers = answers.filter((a) => a.idSession === session.idSession);
			const sessionRatings = sessionAnswers
				.filter((a) => a.score !== null && a.score !== undefined)
				.map((a) => a.score);

			if (sessionRatings.length > 0) {
				monthData.ratingSum += sessionRatings.reduce((a, b) => a + b, 0);
				monthData.ratingCount += sessionRatings.length;
			}
		}

		const sessionsByMonth = Array.from(sessionsByMonthMap.entries())
			.map(([month, data]) => ({
				month,
				sessions: data.sessions,
				averageRating: data.ratingCount > 0
					? Number((data.ratingSum / data.ratingCount).toFixed(2))
					: 0,
			}))
			.sort((a, b) => a.month.localeCompare(b.month));

		// Build response
		return {
			tutorId,
			tutorName: tutor.name,
			period: {
				startDate: startDate || null,
				endDate: endDate || null,
				description: startDate || endDate ? `Período: ${startDate} a ${endDate}` : 'Todas las métricas históricas',
			},
			ratingMetrics: {
				averageOverall,
				totalEvaluations: uniqueEvaluationIds.size,
				averageByAspect,
				ratingDistribution,
			},
			sessionMetrics: {
				totalSessionsCompleted: sessions.length,
				sessionsByType,
				sessionsByModality: sessionsByModalityMap,
				sessionsBySubject,
			},
			attendanceMetrics: {
				attendanceRate,
				presentCount,
				absentCount,
				lateCount,
				noShowCount,
			},
			temporalMetrics: {
				sessionsByMonth,
			},
			calculatedAt: new Date().toISOString(),
		};
	}

	private calculateAspectAverage(aspectRatings: Map<string, number[]>, aspect: string): number {
		const ratings = aspectRatings.get(aspect) || [];
		return ratings.length > 0
			? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
			: 0;
	}
}

