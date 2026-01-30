import { Module } from '@nestjs/common';
import { AvailabilityService } from '../availability/services/availability.service';
import { SchedulingService } from './services/scheduling.service';
import { AvailabilityController } from '../availability/controllers/availability.controller';
import { SessionsController } from './controllers/sessions.controller';

@Module({
  providers: [AvailabilityService, SchedulingService],
  controllers: [AvailabilityController, SessionsController]
})
export class SchedulingModule {}
