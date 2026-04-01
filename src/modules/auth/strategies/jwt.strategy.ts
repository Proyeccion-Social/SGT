// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserService } from '../../users/services/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default_secret',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Validar que sea access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Buscar usuario
    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Validar que esté activo
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    // El usuario se inyecta en request.user
    return user;
  }
}
