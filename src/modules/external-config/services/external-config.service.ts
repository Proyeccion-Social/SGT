import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessConfig } from '../interfaces/business-config.interface';
import { DEFAULT_BUSINESS_CONFIG } from '../defaults/business-config.defaults';
import { UpdateConfigDto } from '../dto/update-config.dto';

@Injectable()
export class ExternalConfigService implements OnModuleInit {
  private readonly logger = new Logger(ExternalConfigService.name);
  private readonly configFilePath = path.join(
    process.cwd(),
    'config',
    'business-config.json',
  );
  private config: BusinessConfig;

  onModuleInit() {
    this.config = this.loadConfig();
  }

  private loadConfig(): BusinessConfig {
    try {
      if (!fs.existsSync(this.configFilePath)) {
        this.logger.warn(
          `Config file not found at ${this.configFilePath}. Creating with defaults.`,
        );
        this.persistConfig(DEFAULT_BUSINESS_CONFIG);
        return structuredClone(DEFAULT_BUSINESS_CONFIG);
      }

      const raw = fs.readFileSync(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const merged = this.deepMerge(
        structuredClone(DEFAULT_BUSINESS_CONFIG),
        parsed,
      );
      this.logger.log('Business config loaded successfully.');
      return merged;
    } catch (err) {
      this.logger.error(
        `Failed to load business config: ${err.message}. Using defaults.`,
      );
      return structuredClone(DEFAULT_BUSINESS_CONFIG);
    }
  }

  private persistConfig(config: BusinessConfig): void {
    const dir = path.dirname(this.configFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  private deepMerge<T extends object>(base: T, override: Partial<T>): T {
    const result = { ...base };
    for (const key of Object.keys(override) as (keyof T)[]) {
      const overrideVal = override[key];
      const baseVal = base[key];
      if (
        overrideVal !== null &&
        typeof overrideVal === 'object' &&
        !Array.isArray(overrideVal) &&
        typeof baseVal === 'object' &&
        !Array.isArray(baseVal)
      ) {
        result[key] = this.deepMerge(baseVal as object, overrideVal as object) as T[keyof T];
      } else if (overrideVal !== undefined) {
        result[key] = overrideVal as T[keyof T];
      }
    }
    return result;
  }

  getConfig(): BusinessConfig {
    return structuredClone(this.config);
  }

  updateConfig(dto: UpdateConfigDto): BusinessConfig {
    this.validateUpdateDto(dto);
    this.config = this.deepMerge(this.config, dto as Partial<BusinessConfig>);
    this.persistConfig(this.config);
    this.logger.log('Business config updated and persisted.');
    return structuredClone(this.config);
  }

  private validateUpdateDto(dto: UpdateConfigDto): void {
    const errors: string[] = [];

    if (dto.scheduling) {
      const s = dto.scheduling;
      if (s.cancellation_notice_hours !== undefined && (s.cancellation_notice_hours < 1 || s.cancellation_notice_hours > 168)) {
        errors.push('scheduling.cancellation_notice_hours must be between 1 and 168');
      }
      if (s.modification_expiry_hours !== undefined && (s.modification_expiry_hours < 1 || s.modification_expiry_hours > 168)) {
        errors.push('scheduling.modification_expiry_hours must be between 1 and 168');
      }
      if (s.allowed_duration_hours !== undefined) {
        if (!Array.isArray(s.allowed_duration_hours) || s.allowed_duration_hours.length === 0) {
          errors.push('scheduling.allowed_duration_hours must be a non-empty array');
        } else if (s.allowed_duration_hours.some((h) => typeof h !== 'number' || h <= 0 || h > 8)) {
          errors.push('scheduling.allowed_duration_hours values must be numbers between 0 and 8');
        }
      }
    }

    if (dto.notifications) {
      const n = dto.notifications;
      if (n.confirmation_expiry_hours !== undefined && (n.confirmation_expiry_hours < 1 || n.confirmation_expiry_hours > 168)) {
        errors.push('notifications.confirmation_expiry_hours must be between 1 and 168');
      }
      if (n.reminder_hours_before !== undefined) {
        if (!Array.isArray(n.reminder_hours_before) || n.reminder_hours_before.length === 0) {
          errors.push('notifications.reminder_hours_before must be a non-empty array');
        }
      }
      if (n.weekly_hours_alert_thresholds !== undefined) {
        if (!Array.isArray(n.weekly_hours_alert_thresholds) || n.weekly_hours_alert_thresholds.length === 0) {
          errors.push('notifications.weekly_hours_alert_thresholds must be a non-empty array');
        } else if (n.weekly_hours_alert_thresholds.some((t) => typeof t !== 'number' || t < 1 || t > 100)) {
          errors.push('notifications.weekly_hours_alert_thresholds values must be percentages between 1 and 100');
        }
      }
    }

    if (dto.availability) {
      const a = dto.availability;
      if (a.slot_duration_minutes !== undefined && (a.slot_duration_minutes < 15 || a.slot_duration_minutes > 120)) {
        errors.push('availability.slot_duration_minutes must be between 15 and 120');
      }
      if (a.max_slots_per_day !== undefined && (a.max_slots_per_day < 1 || a.max_slots_per_day > 24)) {
        errors.push('availability.max_slots_per_day must be between 1 and 24');
      }
    }

    if (dto.tutor) {
      const t = dto.tutor;
      if (t.default_weekly_hours_limit !== undefined && (t.default_weekly_hours_limit < 1 || t.default_weekly_hours_limit > 40)) {
        errors.push('tutor.default_weekly_hours_limit must be between 1 and 40');
      }
      if (t.min_weekly_hours !== undefined && (t.min_weekly_hours < 1 || t.min_weekly_hours > 40)) {
        errors.push('tutor.min_weekly_hours must be between 1 and 40');
      }
      if (t.max_weekly_hours !== undefined && (t.max_weekly_hours < 1 || t.max_weekly_hours > 168)) {
        errors.push('tutor.max_weekly_hours must be between 1 and 168');
      }
      if (
        t.min_weekly_hours !== undefined &&
        t.max_weekly_hours !== undefined &&
        t.min_weekly_hours >= t.max_weekly_hours
      ) {
        errors.push('tutor.min_weekly_hours must be less than max_weekly_hours');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
  }
}
