import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 63, unique: true })
  slug: string;

  @Column({ length: 255 })
  companyName: string;

  @Column({ nullable: true, length: 14 })
  companySiret: string;

  @Column({ nullable: true, type: 'text' })
  companyAddress: string;

  @Column({ nullable: true, length: 20 })
  companyPhone: string;

  @Column({ nullable: true, type: 'text' })
  companyLogoUrl: string;

  @Column({ nullable: true, type: 'text' })
  depotAddress: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 30 })
  marginMaterial: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 15 })
  hourlyRate: number;

  @Column({ type: 'numeric', precision: 5, scale: 3, default: 0.3 })
  kmRate: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10 })
  tvaRate: number;

  @Column({ nullable: true, type: 'text' })
  anthropicKeyEncrypted: string;

  @Column({ nullable: true, type: 'text' })
  googleMapsKeyEncrypted: string;

  @Column({ nullable: true })
  smtpHost: string;

  @Column({ nullable: true, type: 'int' })
  smtpPort: number;

  @Column({ nullable: true })
  smtpUser: string;

  @Column({ nullable: true, type: 'text' })
  smtpPassEncrypted: string;

  @Column({
    type: 'varchar',
    enum: ['trial', 'active', 'suspended', 'cancelled'],
    default: 'trial',
  })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  trialEndsAt: Date;

  @Column({ nullable: true })
  planId: string;

  @Column({ type: 'varchar', enum: ['monthly', 'annual'], nullable: true })
  billingCycle: string;

  @Column({ type: 'datetime', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'datetime', nullable: true })
  currentPeriodEnd: Date;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ default: 0 })
  devisCountThisMonth: number;

  @Column({ type: 'bigint', default: 0 })
  storageUsedBytes: number;

  @Column({ default: 0 })
  totalDevisGenerated: number;

  @Column({ type: 'bigint', default: 0 })
  totalTokensConsumed: number;

  @Column({ type: 'datetime', nullable: true })
  subscribedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true, type: 'text' })
  ibanEncrypted: string;

  @Column({ nullable: true, type: 'text' })
  mandatSepaUrl: string;

  @Column({ nullable: true, type: 'text' })
  contratUrl: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
