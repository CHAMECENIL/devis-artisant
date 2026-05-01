import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', enum: ['bronze', 'silver', 'gold'], unique: true })
  name: string;

  @Column({ length: 50 })
  label: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  priceMonthly: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  priceAnnual: number;

  @Column({ default: 1 })
  maxUsers: number;

  /** Nombre max de devis par mois. -1 = illimité */
  @Column({ default: 10 })
  maxDevisPerMonth: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 1 })
  maxStorageGb: number;

  @Column({ default: false })
  aiEnabled: boolean;

  @Column({ default: false })
  gedEnabled: boolean;

  @Column({ default: false })
  signatureEnabled: boolean;

  @Column({ default: false })
  multiUserEnabled: boolean;

  @Column({ type: 'simple-json', default: '{}' })
  features: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
