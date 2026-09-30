import { AppNotificationType } from '../../app-notification/entities/app-notification.entity';
import { Session } from '../../scheduling/entities/session.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.sendPendingSessionWithdrawal', () => {
  let service: NotificationsService;
  let appNotifications: any;
  let emailService: any;

  beforeEach(() => {
    appNotifications = { create: jest.fn().mockResolvedValue(undefined) };
    emailService = { send: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(
      { get: jest.fn(() => 'http://localhost') } as any,
      {} as any,
      appNotifications,
      emailService,
    );
  });

  it('creates an in-app notification with the reason and sends no email', async () => {
    const session = {
      idSession: 'session-1',
      idTutor: 'tutor-1',
      cancellationReason: 'Ya no necesito la tutoría',
      subject: { name: 'Álgebra' },
    } as Session;

    await service.sendPendingSessionWithdrawal(session, 'Ana Pérez');

    expect(appNotifications.create).toHaveBeenCalledWith({
      userId: 'tutor-1',
      type: AppNotificationType.SESSION_REQUEST_WITHDRAWN,
      message:
        'Ana Pérez retiró la solicitud de tutoría de Álgebra. Motivo: Ya no necesito la tutoría',
      payload: { sessionId: 'session-1' },
    });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('omits the reason when it was not provided', async () => {
    const session = {
      idSession: 'session-1',
      idTutor: 'tutor-1',
      subject: { name: 'Álgebra' },
    } as Session;

    await service.sendPendingSessionWithdrawal(session, 'Ana Pérez');

    expect(appNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Ana Pérez retiró la solicitud de tutoría de Álgebra.',
      }),
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
