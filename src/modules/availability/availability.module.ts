import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityService } from './services/availability.service';
import { AvailabilityController } from './controllers/availability.controller';
import { Availability } from './entities/availability.entity';
import { TutorHaveAvailability } from './entities/tutor-availability.entity';

import { SubjectsModule } from '../subjects/subjects.module';
import { TutorModule } from '../tutor/tutor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Availability, TutorHaveAvailability], 'local'),
    SubjectsModule,
    TutorModule,
  ],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
  exports: [TypeOrmModule, AvailabilityService],
})
export class AvailabilityModule { }