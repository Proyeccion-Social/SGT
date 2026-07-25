import { Entity, PrimaryColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('dashboard_banner')
export class DashboardBanner {
  // Fijo en 1: solo existe una fila, siempre se actualiza la misma.
  // El CHECK constraint en la migración refuerza esto a nivel de BD.
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id: number;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'target_url', type: 'text' })
  targetUrl: string;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedBy: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User;
}