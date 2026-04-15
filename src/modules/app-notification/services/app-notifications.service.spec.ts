import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotificationType } from '../entities/app-notification.entity';

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let notificationRepository: any;

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: AppNotificationType.SESSION_CONFIRMED,
    message: 'Your session is confirmed',
    payload: null,
    read: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    notificationRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    service = new AppNotificationsService(notificationRepository);
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('persists notification with read=false and returns it', async () => {
      notificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create({
        userId: 'user-1',
        type: AppNotificationType.SESSION_CONFIRMED,
        message: 'Your session is confirmed',
      });

      const created = notificationRepository.create.mock.calls[0][0];
      expect(created.read).toBe(false);
      expect(created.userId).toBe('user-1');
      expect(result).toEqual(mockNotification);
    });

    it('uses null when payload is not provided', async () => {
      notificationRepository.save.mockResolvedValue(mockNotification);

      await service.create({
        userId: 'user-1',
        type: AppNotificationType.SESSION_CONFIRMED,
        message: 'msg',
      });

      expect(notificationRepository.create.mock.calls[0][0].payload).toBeNull();
    });
  });

  // ─── createMany ───────────────────────────────────────────────────────────────

  describe('createMany', () => {
    it('does nothing for an empty list', async () => {
      await service.createMany([]);

      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('saves all notifications in a single batch', async () => {
      notificationRepository.save.mockResolvedValue([]);

      await service.createMany([
        { userId: 'user-1', type: AppNotificationType.SESSION_CONFIRMED, message: 'msg1' },
        { userId: 'user-2', type: AppNotificationType.SESSION_CONFIRMED, message: 'msg2' },
      ]);

      const saved = notificationRepository.save.mock.calls[0][0];
      expect(saved).toHaveLength(2);
    });
  });

  // ─── findByUser ───────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('returns paginated notifications with unread count in meta', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[mockNotification], 1]);
      notificationRepository.count.mockResolvedValue(1);

      const result = await service.findByUser('user-1', 1, 20);

      expect(result.data).toEqual([mockNotification]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(1);
    });

    it('filters by read=false when onlyUnread is true', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser('user-1', 1, 20, true);

      const whereClause = notificationRepository.findAndCount.mock.calls[0][0].where;
      expect(whereClause.read).toBe(false);
    });

    it('does not add read filter when onlyUnread is false', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      notificationRepository.count.mockResolvedValue(0);

      await service.findByUser('user-1', 1, 20, false);

      const whereClause = notificationRepository.findAndCount.mock.calls[0][0].where;
      expect(whereClause.read).toBeUndefined();
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('notif-999', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when notification belongs to another user', async () => {
      notificationRepository.findOne.mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('does not call update if notification is already read', async () => {
      notificationRepository.findOne.mockResolvedValue({ ...mockNotification, read: true });

      await service.markAsRead('notif-1', 'user-1');

      expect(notificationRepository.update).not.toHaveBeenCalled();
    });

    it('calls update with read=true for an unread notification', async () => {
      notificationRepository.findOne.mockResolvedValue(mockNotification);
      notificationRepository.update.mockResolvedValue({ affected: 1 });

      await service.markAsRead('notif-1', 'user-1');

      expect(notificationRepository.update).toHaveBeenCalledWith('notif-1', { read: true });
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('returns the count of updated notifications', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(3);
      expect(notificationRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', read: false },
        { read: true },
      );
    });

    it('returns 0 when no unread notifications exist', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updated).toBe(0);
    });
  });
});
