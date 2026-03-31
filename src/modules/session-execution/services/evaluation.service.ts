import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';

@Injectable()
export class EvaluationService {
	constructor(
		@InjectRepository(Question, 'local')
		private readonly questionRepository: Repository<Question>,
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
}

