import { BusinessConfig } from '../interfaces/business-config.interface';

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  scheduling: {
    cancellation_notice_hours: 24,
    modification_expiry_hours: 24,
    allowed_duration_hours: [1, 1.5, 2],
  },
  notifications: {
    confirmation_expiry_hours: 24,
    reminder_hours_before: [24, 2],
    weekly_hours_alert_thresholds: [80, 95, 100],
  },
  availability: {
    slot_duration_minutes: 30,
    max_slots_per_day: 8,
  },
  tutor: {
    default_weekly_hours_limit: 8,
    min_weekly_hours: 1,
    max_weekly_hours: 40,
  },
};
