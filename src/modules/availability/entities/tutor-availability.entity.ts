import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tutor } from '../../tutor/entities/tutor.entity';
import { Availability } from './availability.entity';

export enum Modality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}

@Entity('tutor_have_availability')
export class TutorHaveAvailability {
  @PrimaryColumn({ name: 'id_tutor', type: 'bigint' })
  idTutor: number;

  @PrimaryColumn({ name: 'id_availability', type: 'bigint' })
  idAvailability: number;

  @Column({
    type: 'enum',
    enum: Modality,
    nullable: true,
  })
  modality: Modality;

  @ManyToOne(() => Tutor, (tutor) => tutor.tutorHaveAvailabilities)
  @JoinColumn({ name: 'id_tutor' })
  tutor: Tutor;

  @ManyToOne(
    () => Availability,
    (availability) => availability.tutorHaveAvailabilities,
  )
  @JoinColumn({ name: 'id_availability' })
  availability: Availability;
}
