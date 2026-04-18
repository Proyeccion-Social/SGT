// src/auth/interfaces/jwt-payload.interface.ts
import { UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number; // Issued at
  exp?: number; // Expiration
}