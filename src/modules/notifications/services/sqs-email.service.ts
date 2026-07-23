import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

@Injectable()
export class SqsEmailService {
  private readonly logger = new Logger(SqsEmailService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    this.queueUrl = this.configService.get<string>('SQS_QUEUE_URL') ?? '';

    if (!this.queueUrl) {
      this.logger.warn(
        'SQS_QUEUE_URL no está definida — los emails no se publicarán en SQS',
      );
    }

    this.sqs = new SQSClient({ region });
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.queueUrl) {
      this.logger.warn(
        `Email omitido (sin SQS_QUEUE_URL): subject="${payload.subject}"`,
      );
      return;
    }

    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );

    this.logger.debug(`Mensaje encolado en SQS: subject="${payload.subject}"`);
  }
}
