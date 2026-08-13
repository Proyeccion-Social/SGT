// src/auth/dto/change-password.dto.ts
import { IsString, MinLength, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_POLICY_MESSAGE,
} from '../constants/password-policy.constants';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;

  @IsString()
  confirmNewPassword: string;
}
