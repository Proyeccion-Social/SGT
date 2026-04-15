import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Mock Resend before importing the service so the constructor can instantiate it.
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let configService: any;
  let usersService: any;
  let appNotifications: any;
  let resendSendMock: jest.Mock;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          RESEND_API_KEY: 'test-api-key',
          RESEND_FROM_EMAIL: 'noreply@test.com',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return map[key] ?? null;
      }),
    };
    usersService = { findById: jest.fn(), findByIds: jest.fn() };
    appNotifications = { create: jest.fn().mockResolvedValue({}) };

    service = new NotificationsService(
      configService,
      usersService,
      appNotifications,
    );

    // Replace the internal Resend instance with a controllable mock
    resendSendMock = jest.fn().mockResolvedValue({ error: null });
    (service as any).resend = { emails: { send: resendSendMock } };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // settleAll — error-routing logic (the most critical private method)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('settleAll', () => {
    it('resolves when all operations succeed', async () => {
      await expect(
        (service as any).settleAll([
          { label: 'email', context: 'test', promise: Promise.resolve() },
          {
            label: 'persistencia',
            context: 'test',
            promise: Promise.resolve(),
          },
        ]),
      ).resolves.toBeUndefined();
    });

    it('re-throws the error when an email operation fails', async () => {
      const emailError = new Error('SMTP connection refused');

      await expect(
        (service as any).settleAll([
          {
            label: 'email',
            context: 'test',
            promise: Promise.reject(emailError),
          },
          {
            label: 'persistencia',
            context: 'test',
            promise: Promise.resolve(),
          },
        ]),
      ).rejects.toThrow('SMTP connection refused');
    });

    it('does NOT throw when only a persistence operation fails', async () => {
      await expect(
        (service as any).settleAll([
          { label: 'email', context: 'test', promise: Promise.resolve() },
          {
            label: 'persistencia',
            context: 'test',
            promise: Promise.reject(new Error('DB timeout')),
          },
        ]),
      ).resolves.toBeUndefined();
    });

    it('re-throws the email error even when persistence also fails', async () => {
      const emailError = new Error('Email failed');

      await expect(
        (service as any).settleAll([
          {
            label: 'email',
            context: 'test',
            promise: Promise.reject(emailError),
          },
          {
            label: 'persistencia',
            context: 'test',
            promise: Promise.reject(new Error('DB failed')),
          },
        ]),
      ).rejects.toThrow('Email failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // formatDate — timezone-safe date formatting
  // ═══════════════════════════════════════════════════════════════════════════

  describe('formatDate', () => {
    it('formats a date string in Spanish locale without shifting the day', () => {
      // 2025-04-07 is Monday (lunes) — must not shift to Sunday due to UTC offset
      const result: string = (service as any).formatDate('2025-04-07');

      expect(result).toContain('2025');
      expect(result.toLowerCase()).toContain('lunes');
      expect(result.toLowerCase()).toContain('abril');
    });

    it('produces the same output for a Date object as for its ISO string', () => {
      const dateObj = new Date(Date.UTC(2025, 3, 7)); // April 7 2025 UTC
      const asString: string = (service as any).formatDate('2025-04-07');
      const asDate: string = (service as any).formatDate(dateObj);

      expect(asString).toBe(asDate);
    });

    it('formats the last day of a month correctly', () => {
      const result: string = (service as any).formatDate('2025-01-31');

      expect(result.toLowerCase()).toContain('enero');
      expect(result).toContain('31');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // formatDateTime — date + time formatting
  // ═══════════════════════════════════════════════════════════════════════════

  describe('formatDateTime', () => {
    it('includes the minute in the formatted output (es-CO uses 12h clock)', () => {
      // es-CO locale formats 14:30 UTC as "02:30 p. m." — check minutes, not 24h hour
      const date = new Date(Date.UTC(2025, 3, 7, 14, 30)); // 14:30 UTC
      const result: string = (service as any).formatDateTime(date);

      expect(result).toContain('30');
      expect(result.toLowerCase()).toContain('lunes');
    });

    it('accepts an ISO string as input', () => {
      const result: string = (service as any).formatDateTime(
        '2025-04-07T09:00:00.000Z',
      );

      expect(result.toLowerCase()).toContain('lunes');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // translateModality
  // ═══════════════════════════════════════════════════════════════════════════

  describe('translateModality', () => {
    it('translates PRES to Presencial', () => {
      expect((service as any).translateModality('PRES')).toBe('Presencial');
    });

    it('translates VIRT to Virtual', () => {
      expect((service as any).translateModality('VIRT')).toBe('Virtual');
    });

    it('falls back to Virtual for unknown values', () => {
      expect((service as any).translateModality('HYBRID')).toBe('Virtual');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateDurationFromEntity
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateDurationFromEntity', () => {
    it('calculates whole-hour duration correctly', () => {
      const session = { startTime: '09:00', endTime: '11:00' } as any;

      expect((service as any).calculateDurationFromEntity(session)).toBe(2);
    });

    it('calculates half-hour duration correctly', () => {
      const session = { startTime: '09:00', endTime: '09:30' } as any;

      expect((service as any).calculateDurationFromEntity(session)).toBe(0.5);
    });

    it('calculates fractional duration correctly', () => {
      const session = { startTime: '09:00', endTime: '10:45' } as any;

      expect((service as any).calculateDurationFromEntity(session)).toBe(1.75);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateNewEndTime — string-based arithmetic (edge cases matter)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('calculateNewEndTime', () => {
    it('calculates end time for a standard session', () => {
      const request = { newStartTime: '09:00', newDurationHours: 1.5 } as any;

      expect((service as any).calculateNewEndTime(request)).toBe('10:30');
    });

    it('wraps past midnight correctly', () => {
      const request = { newStartTime: '22:30', newDurationHours: 2 } as any;

      expect((service as any).calculateNewEndTime(request)).toBe('00:30');
    });

    it('pads single-digit hours with a leading zero', () => {
      const request = { newStartTime: '08:00', newDurationHours: 1 } as any;

      expect((service as any).calculateNewEndTime(request)).toBe('09:00');
    });

    it('returns empty string when newStartTime is missing', () => {
      const request = { newDurationHours: 1 } as any;

      expect((service as any).calculateNewEndTime(request)).toBe('');
    });

    it('returns empty string when newDurationHours is missing', () => {
      const request = { newStartTime: '09:00' } as any;

      expect((service as any).calculateNewEndTime(request)).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getUserEmail — private lookup
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUserEmail', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect((service as any).getUserEmail('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the user email when found', async () => {
      usersService.findById.mockResolvedValue({
        email: 'user@udistrital.edu.co',
      });

      const email = await (service as any).getUserEmail('user-1');

      expect(email).toBe('user@udistrital.edu.co');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // sendHourLimitAlert — alert level thresholds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sendHourLimitAlert — alert level assignment', () => {
    // Spy on renderTemplate to avoid filesystem access and capture template data
    let renderSpy: jest.SpyInstance;

    beforeEach(() => {
      renderSpy = jest
        .spyOn(service as any, 'renderTemplate')
        .mockReturnValue('<html>mock</html>');
    });

    const callAlert = (usagePercentage: number) =>
      service.sendHourLimitAlert(
        'tutor-1',
        'Bob',
        'bob@udistrital.edu.co',
        10,
        10 * (usagePercentage / 100),
        usagePercentage,
      );

    it('assigns 100_PERCENT / critical when usage is exactly 100%', async () => {
      await callAlert(100);

      const data = renderSpy.mock.calls[0][1];
      expect(data.alertLevel).toBe('100_PERCENT');
      expect(data.urgencyLevel).toBe('critical');
      expect(data.canAcceptMore).toBe(false);
      expect(data.is100Percent).toBe(true);
    });

    it('assigns 100_PERCENT / critical when usage exceeds 100%', async () => {
      await callAlert(110);

      const data = renderSpy.mock.calls[0][1];
      expect(data.alertLevel).toBe('100_PERCENT');
      expect(data.urgencyLevel).toBe('critical');
    });

    it('assigns 95_PERCENT / urgent when usage is between 95% and 99%', async () => {
      await callAlert(97);

      const data = renderSpy.mock.calls[0][1];
      expect(data.alertLevel).toBe('95_PERCENT');
      expect(data.urgencyLevel).toBe('urgent');
      expect(data.canAcceptMore).toBe(true);
      expect(data.is95Percent).toBe(true);
    });

    it('assigns 95_PERCENT / urgent at exactly 95%', async () => {
      await callAlert(95);

      const data = renderSpy.mock.calls[0][1];
      expect(data.alertLevel).toBe('95_PERCENT');
    });

    it('assigns 80_PERCENT / warning when usage is below 95%', async () => {
      await callAlert(82);

      const data = renderSpy.mock.calls[0][1];
      expect(data.alertLevel).toBe('80_PERCENT');
      expect(data.urgencyLevel).toBe('warning');
      expect(data.is80Percent).toBe(true);
    });

    it('sends email with the correct subject for each alert level', async () => {
      await callAlert(100);
      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Límite semanal alcanzado'),
        }),
      );

      resendSendMock.mockClear();
      renderSpy.mockClear();

      await callAlert(95);
      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('límite semanal'),
        }),
      );
    });

    it('persists an in-app notification with the correct alertLevel payload', async () => {
      await callAlert(100);

      expect(appNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { alertLevel: '100_PERCENT' },
        }),
      );
    });
  });
});
