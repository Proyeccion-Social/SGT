import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityService } from './services/availability.service';
import { AvailabilityController } from './controllers/availability.controller';
import { Availability } from './entities/availability.entity';
import { TutorHaveAvailability } from './entities/tutor-availability.entity';

import { SubjectsModule } from '../subjects/subjects.module';
import { TutorModule } from '../tutor/tutor.module';
import { ScheduledSession } from '../scheduling/entities/scheduled-session.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Availability, TutorHaveAvailability,ScheduledSession], 'local'),
    SubjectsModule,
    TutorModule,
    AuthModule, //Para usar JwtAuthGuard en el controller y RolesGuard
  ],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
  exports: [TypeOrmModule, AvailabilityService],
})
export class AvailabilityModule { }