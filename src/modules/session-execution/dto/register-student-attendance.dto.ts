import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParticipationStatus } from '../../scheduling/enums/participation-status.enum';

export type AttendanceStatus =
  | ParticipationStatus.ATTENDED
  | ParticipationStatus.ABSENT
  | ParticipationStatus.LATE;

export const ALLOWED_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  ParticipationStatus.ATTENDED,
  ParticipationStatus.ABSENT,
  ParticipationStatus.LATE,
];

export class AttendanceItemDto {
  @IsUUID()
  studentId: string;

  @IsIn(ALLOWED_ATTENDANCE_STATUSES)
  status: AttendanceStatus;

  @IsOptional()
  @IsISO8601()
  arrivalTime?: string;
}

export class RegisterStudentAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  attendances: AttendanceItemDto[];
}
