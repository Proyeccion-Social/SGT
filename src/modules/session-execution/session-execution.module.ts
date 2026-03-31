import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { SessionExecutionController } from './controllers/session-execution.controller';
import { SessionExecutionService } from './services/session-execution.service';
import { JwtStrategy } from './guards/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'default_secret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [SessionExecutionController],
  providers: [SessionExecutionService, JwtStrategy, RolesGuard],
  exports: [SessionExecutionService],
})
export class SessionExecutionModule {}
