import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Availability } from '../modules/availability/entities/availability.entity';
import { TutorHaveAvailability } from '../modules/availability/entities/tutor-availability.entity';
import { User } from '../modules/users/entities/user.entity';
import { Modality } from '../modules/availability/enums/modality.enum';

export class AvailabilitySeeder {
  private readonly logger = new Logger(AvailabilitySeeder.name);

  public async run(dataSource: DataSource): Promise<void> {
    const availRepo = dataSource.getRepository(Availability);
    const tutorAvailRepo = dataSource.getRepository(TutorHaveAvailability);
    const userRepo = dataSource.getRepository(User);

    // ─── FRANJAS HORARIAS ─────────────────────────────────────────────────────
    // day_of_week: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
    const slots = [
      { dayOfWeek: 1, startTime: '08:00:00' }, // Lunes 8am
      { dayOfWeek: 1, startTime: '10:00:00' }, // Lunes 10am
      { dayOfWeek: 2, startTime: '08:00:00' }, // Martes 8am
      { dayOfWeek: 2, startTime: '14:00:00' }, // Martes 2pm
      { dayOfWeek: 3, startTime: '08:00:00' }, // Miércoles 8am
      { dayOfWeek: 3, startTime: '10:00:00' }, // Miércoles 10am
      { dayOfWeek: 4, startTime: '08:00:00' }, // Jueves 8am
      { dayOfWeek: 5, startTime: '10:00:00' }, // Viernes 10am
    ];

    const savedSlots: Availability[] = [];
    for (const slot of slots) {
      const exists = await availRepo.findOne({
        where: { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime },
      });
      if (!exists) {
        const saved = await availRepo.save(availRepo.create(slot));
        savedSlots.push(saved);
        this.logger.log(`Availability slot created: day ${slot.dayOfWeek} at ${slot.startTime}`);
      } else {
        savedSlots.push(exists);
        this.logger.log(`Availability slot already exists: day ${slot.dayOfWeek} at ${slot.startTime}`);
      }
    }

    // ─── TUTOR → DISPONIBILIDAD ────────────────────────────────────────────────
    // Carlos (Lunes y Martes, presencial)
    const carlos = await userRepo.findOne({ where: { email: 'carlos.ramirez@sgt.com' } });
    // María (Miércoles y Jueves, virtual)
    const maria = await userRepo.findOne({ where: { email: 'maria.hernandez@sgt.com' } });

    const tutorSlots: Array<{ tutorId: string; slotIndex: number; modality: Modality }> = [];

    if (carlos) {
      tutorSlots.push(
        { tutorId: carlos.idUser, slotIndex: 0, modality: Modality.PRES }, // Lunes 8am
        { tutorId: carlos.idUser, slotIndex: 1, modality: Modality.PRES }, // Lunes 10am
        { tutorId: carlos.idUser, slotIndex: 2, modality: Modality.PRES }, // Martes 8am
        { tutorId: carlos.idUser, slotIndex: 3, modality: Modality.VIRT }, // Martes 2pm (virtual opcional)
      );
    }

    if (maria) {
      tutorSlots.push(
        { tutorId: maria.idUser, slotIndex: 4, modality: Modality.VIRT }, // Miércoles 8am
        { tutorId: maria.idUser, slotIndex: 5, modality: Modality.VIRT }, // Miércoles 10am
        { tutorId: maria.idUser, slotIndex: 6, modality: Modality.VIRT }, // Jueves 8am
        { tutorId: maria.idUser, slotIndex: 7, modality: Modality.VIRT }, // Viernes 10am
      );
    }

    for (const { tutorId, slotIndex, modality } of tutorSlots) {
      const slot = savedSlots[slotIndex];
      if (!slot) continue;
      const exists = await tutorAvailRepo.findOne({
        where: { idTutor: tutorId, idAvailability: slot.idAvailability },
      });
      if (!exists) {
        await tutorAvailRepo.save(tutorAvailRepo.create({
          idTutor: tutorId, idAvailability: slot.idAvailability, modality,
        }));
        this.logger.log(`TutorAvailability seeded: tutor ${tutorId} slot ${slot.idAvailability}`);
      } else {
        this.logger.log(`TutorAvailability already exists`);
      }
    }

    this.logger.log('AvailabilitySeeder completed.');
  }
}
