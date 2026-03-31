export interface SchedulingConfig {
  cancellation_notice_hours: number;
  modification_expiry_hours: number;
  allowed_duration_hours: number[];
}

export interface NotificationsConfig {
  confirmation_expiry_hours: number;
  reminder_hours_before: number[];
  weekly_hours_alert_thresholds: number[];
}

export interface AvailabilityConfig {
  slot_duration_minutes: number;
  max_slots_per_day: number;
}

export interface TutorConfig {
  default_weekly_hours_limit: number;
  min_weekly_hours: number;
  max_weekly_hours: number;
}

export interface BusinessConfig {
  scheduling: SchedulingConfig;
  notifications: NotificationsConfig;
  availability: AvailabilityConfig;
  tutor: TutorConfig;
}
