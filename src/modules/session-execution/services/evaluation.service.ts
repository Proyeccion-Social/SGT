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
}

