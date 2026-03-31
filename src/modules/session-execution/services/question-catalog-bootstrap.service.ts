import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question, QuestionAspect } from '../entities/question.entity';

const DEFAULT_QUESTIONNAIRE_VERSION = '1.0';

type DefaultQuestion = {
  aspect: QuestionAspect;
  label: string;
  content: string;
  description: string;
  displayOrder: number;
};

const DEFAULT_QUESTIONS: DefaultQuestion[] = [
  {
    aspect: QuestionAspect.CLARITY,
    label: 'Claridad de explicacion',
    content: 'Claridad de explicacion',
    description: 'Que tan claro fue el tutor al explicar los conceptos?',
    displayOrder: 1,
  },
  {
    aspect: QuestionAspect.PATIENCE,
    label: 'Paciencia y disposicion',
    content: 'Paciencia y disposicion',
    description: 'Que tan paciente y dispuesto fue el tutor?',
    displayOrder: 2,
  },
  {
    aspect: QuestionAspect.PUNCTUALITY,
    label: 'Puntualidad',
    content: 'Puntualidad',
    description: 'El tutor fue puntual?',
    displayOrder: 3,
  },
  {
    aspect: QuestionAspect.KNOWLEDGE,
    label: 'Dominio del tema',
    content: 'Dominio del tema',
    description: 'Que tan bien dominaba el tutor el tema?',
    displayOrder: 4,
  },
  {
    aspect: QuestionAspect.USEFULNESS,
    label: 'Utilidad de la sesion',
    content: 'Utilidad de la sesion',
    description: 'Que tan util fue la sesion para tu aprendizaje?',
    displayOrder: 5,
  },
];

@Injectable()
export class QuestionCatalogBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(QuestionCatalogBootstrapService.name);

  constructor(
    @InjectRepository(Question, 'local')
    private readonly questionRepository: Repository<Question>,
  ) {}

  async onModuleInit(): Promise<void> {
    const existingQuestions = await this.questionRepository.find({
      where: {
        questionnaireVersion: DEFAULT_QUESTIONNAIRE_VERSION,
      },
    });

    const existingAspects = new Set(
      existingQuestions.map((question) => question.aspect),
    );

    const questionsToInsert = DEFAULT_QUESTIONS.filter(
      (question) => !existingAspects.has(question.aspect),
    ).map((question) =>
      this.questionRepository.create({
        ...question,
        questionnaireVersion: DEFAULT_QUESTIONNAIRE_VERSION,
        required: true,
        minScore: 1,
        maxScore: 5,
        isActive: true,
      }),
    );

    if (questionsToInsert.length === 0) {
      this.logger.log('Questionnaire catalog already initialized');
      return;
    }

    await this.questionRepository.save(questionsToInsert);
    this.logger.log(
      `Inserted ${questionsToInsert.length} default questions for questionnaire v${DEFAULT_QUESTIONNAIRE_VERSION}`,
    );
  }
}
