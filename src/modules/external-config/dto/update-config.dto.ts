import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SchedulingConfigDto {
  @IsOptional()
  cancellation_notice_hours?: number;

  @IsOptional()
  modification_expiry_hours?: number;

  @IsOptional()
  allowed_duration_hours?: number[];
}

class NotificationsConfigDto {
  @IsOptional()
  confirmation_expiry_hours?: number;

  @IsOptional()
  reminder_hours_before?: number[];

  @IsOptional()
  weekly_hours_alert_thresholds?: number[];
}

class AvailabilityConfigDto {
  @IsOptional()
  slot_duration_minutes?: number;

  @IsOptional()
  max_slots_per_day?: number;
}

class TutorConfigDto {
  @IsOptional()
  default_weekly_hours_limit?: number;

  @IsOptional()
  min_weekly_hours?: number;

  @IsOptional()
  max_weekly_hours?: number;
}

export class UpdateConfigDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SchedulingConfigDto)
  scheduling?: SchedulingConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationsConfigDto)
  notifications?: NotificationsConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AvailabilityConfigDto)
  availability?: AvailabilityConfigDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TutorConfigDto)
  tutor?: TutorConfigDto;
}
