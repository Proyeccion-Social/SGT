// src/auth/dto/reset-password.dto.ts
import { IsString, MinLength, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_POLICY_MESSAGE,
} from '../constants/password-policy.constants';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @IsString()
  confirmPassword: string;
}
