// src/notifications/dto/notifications.dto.ts
//
// Principio de diseño: cada DTO contiene TODOS los datos necesarios para
// renderizar el email. El servicio llamante (scheduling, availability, cron
// jobs) resuelve los IDs a nombres y datos concretos ANTES de llamar.

import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
// ─────────────────────────────────────────────────────────────────────────────

export enum SessionType {
  INDIVIDUAL = 'INDIVIDUAL',
  COLLABORATIVE = 'COLLABORATIVE',
}

export enum Modality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}

export enum ReminderType {
  HOURS_24_BEFORE = '24_HOURS_BEFORE',
  HOURS_2_BEFORE = '2_HOURS_BEFORE',
}

export enum AvailabilityChangeType {
  CANCELLED = 'CANCELLED',
  MODIFIED = 'MODIFIED',
  SLOT_DELETED = 'SLOT_DELETED',
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-25 | POST /notifications/session-scheduled
//
// Envía dos notificaciones al agendar una sesión individual:
//   1. Solicitud de confirmación al tutor
//   2. Acuse de recibo al estudiante
// Para COLLABORATIVE, usa interestedStudentEmails para la difusión.
// ─────────────────────────────────────────────────────────────────────────────

export class SessionScheduledDto {
  @IsUUID('4', { message: 'sessionId debe ser UUID válido' })
  @IsNotEmpty({ message: 'sessionId es requerido' })
  sessionId: string;

  @IsEnum(SessionType, {
    message: 'sessionType debe ser INDIVIDUAL o COLLABORATIVE',
  })
  @IsNotEmpty({ message: 'Tipo de sesión es requerido' })
  sessionType: SessionType;

  @IsUUID('4', { message: 'tutorId debe ser UUID válido' })
  @IsNotEmpty({ message: 'tutorId es requerido' })
  tutorId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre del tutor es requerido' })
  tutorName: string;

  @IsUUID('4', { message: 'studentId debe ser UUID válido' })
  @IsNotEmpty({ message: 'studentId es requerido' })
  studentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre del estudiante es requerido' })
  studentName: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre de la materia es requerido' })
  subjectName: string;

  @IsDateString({}, { message: 'scheduledDate debe ser fecha ISO válida' })
  scheduledDate: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime debe tener formato HH:mm' })
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime debe tener formato HH:mm' })
  endTime: string;

  @IsNumber({}, { message: 'duration debe ser número' })
  @Min(0.5, { message: 'Duración mínima es 0.5 horas' })
  duration: number;

  @IsEnum(Modality, { message: 'modality debe ser PRES o VIRT' })
  modality: Modality;

  @IsString()
  @IsNotEmpty({ message: 'Título es requerido' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  virtualLink?: string;

  // Solo para sesiones COLLABORATIVE: emails de estudiantes interesados en la materia
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedStudentEmails?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-26 | POST /notifications/session-reminder
//
// El cron job resuelve los datos completos de la sesión antes de llamar.
// Solo se invoca para sesiones en estado SCHEDULED con fecha futura.
// ─────────────────────────────────────────────────────────────────────────────

export class SessionReminderDto {
  @IsUUID('4', { message: 'sessionId debe ser UUID válido' })
  @IsNotEmpty({ message: 'sessionId es requerido' })
  sessionId: string;

  @IsEnum(ReminderType, {
    message: 'reminderType debe ser 24_HOURS_BEFORE o 2_HOURS_BEFORE',
  })
  @IsNotEmpty({ message: 'Tipo de recordatorio es requerido' })
  reminderType: ReminderType;

  @IsUUID('4', { message: 'tutorId debe ser UUID válido' })
  @IsNotEmpty()
  tutorId: string;

  @IsString()
  @IsNotEmpty()
  tutorName: string;

  // IDs y nombres de participantes en el mismo orden (índice a índice)
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos un participante' })
  @IsUUID('4', {
    each: true,
    message: 'Cada participantId debe ser UUID válido',
  })
  participantIds: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantNames: string[];

  @IsString()
  @IsNotEmpty()
  subjectName: string;

  @IsDateString({}, { message: 'scheduledDate debe ser fecha ISO válida' })
  scheduledDate: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime debe tener formato HH:mm' })
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime debe tener formato HH:mm' })
  endTime: string;

  @IsEnum(Modality, { message: 'modality debe ser PRES o VIRT' })
  modality: Modality;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  virtualLink?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-27 | POST /notifications/evaluation-pending
//
// Llamado justo al completar la sesión (isReminder=false) y luego por el
// cron job de 24h si el estudiante no calificó (isReminder=true).
// El servicio llamante controla que no se envíen más de 2 notificaciones.
// ─────────────────────────────────────────────────────────────────────────────

export class EvaluationPendingDto {
  @IsUUID('4', { message: 'sessionId debe ser UUID válido' })
  @IsNotEmpty({ message: 'sessionId es requerido' })
  sessionId: string;

  @IsUUID('4', { message: 'studentId debe ser UUID válido' })
  @IsNotEmpty({ message: 'studentId es requerido' })
  studentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre del estudiante es requerido' })
  studentName: string;

  @IsString()
  @IsNotEmpty()
  tutorName: string;

  @IsString()
  @IsNotEmpty()
  subjectName: string;

  @IsDateString({}, { message: 'sessionDate debe ser fecha ISO válida' })
  sessionDate: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'sessionTime debe tener formato HH:mm' })
  sessionTime: string;

  @IsString()
  @IsNotEmpty()
  sessionTitle: string;

  // El servicio llamante determina si es el primer envío o el recordatorio de 24h
  @IsBoolean({ message: 'isReminder debe ser booleano' })
  isReminder: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-28 | POST /notifications/availability-changed
//
// El módulo de disponibilidad resuelve nombre, email y datos de la sesión
// de cada estudiante afectado antes de llamar este endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export class AffectedSessionItemDto {
  @IsUUID('4', { message: 'sessionId debe ser UUID válido' })
  @IsNotEmpty()
  sessionId: string;

  @IsUUID('4', { message: 'studentId debe ser UUID válido' })
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  studentName: string;

  // Email completo del estudiante, resuelto por el llamante
  @IsString()
  @IsNotEmpty()
  studentEmail: string;

  @IsString()
  @IsNotEmpty()
  subjectName: string;

  @IsDateString({}, { message: 'scheduledDate debe ser fecha ISO válida' })
  scheduledDate: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime debe tener formato HH:mm' })
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime debe tener formato HH:mm' })
  endTime: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(AvailabilityChangeType, {
    message: 'changeType debe ser CANCELLED, MODIFIED o SLOT_DELETED',
  })
  changeType: AvailabilityChangeType;
}

export class AvailabilityChangedDto {
  @IsUUID('4', { message: 'tutorId debe ser UUID válido' })
  @IsNotEmpty({ message: 'tutorId es requerido' })
  tutorId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre del tutor es requerido' })
  tutorName: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos una sesión afectada' })
  @ValidateNested({ each: true })
  @Type(() => AffectedSessionItemDto)
  affectedSessions: AffectedSessionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La razón no puede exceder 200 caracteres' })
  changeReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-29 | POST /notifications/hours-limit-alert
//
// El cron job resuelve nombre y email del tutor antes de llamar.
// La validación @Min(80) en usagePercentage garantiza que solo se invoque
// cuando el umbral de alerta ya fue superado.
// ─────────────────────────────────────────────────────────────────────────────

export class HoursLimitAlertDto {
  @IsUUID('4', { message: 'tutorId debe ser UUID válido' })
  @IsNotEmpty({ message: 'tutorId es requerido' })
  tutorId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nombre del tutor es requerido' })
  tutorName: string;

  // Email real del tutor (puede diferir del email institucional generado por ID)
  @IsString()
  @IsNotEmpty({ message: 'Email del tutor es requerido' })
  tutorEmail: string;

  @IsNumber({}, { message: 'weeklyHourLimit debe ser número' })
  @Min(1, { message: 'Límite debe ser al menos 1' })
  @Max(15, { message: 'Límite máximo es 15' })
  weeklyHourLimit: number;

  @IsNumber({}, { message: 'hoursUsed debe ser número' })
  @Min(0, { message: 'Horas utilizadas no puede ser negativa' })
  hoursUsed: number;

  @IsNumber({}, { message: 'usagePercentage debe ser número' })
  @Min(80, { message: 'Solo se envían alertas cuando uso >= 80%' })
  @Max(100, { message: 'Porcentaje máximo es 100%' })
  usagePercentage: number;
}
