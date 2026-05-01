import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { DevisLigne } from './devis-ligne.entity';

export enum DevisStatut {
  BROUILLON = 'brouillon',
  ENVOYE = 'envoye',
  ACCEPTE = 'accepte',
  REFUSE = 'refuse',
  ARCHIVE = 'archive',
}

@Entity('devis')
export class Devis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'numero', unique: true })
  numero: string;

  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column({ name: 'client_email', nullable: true })
  clientEmail: string;

  @Column({ name: 'client_phone', nullable: true })
  clientPhone: string;

  @Column({ name: 'client_address', nullable: true })
  clientAddress: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'project_type', nullable: true })
  projectType: string;

  @Column({ type: 'varchar', enum: DevisStatut, default: DevisStatut.BROUILLON })
  statut: DevisStatut;

  @Column({ name: 'montant_ht', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montantHt: number;

  @Column({ name: 'tva_rate', type: 'decimal', precision: 5, scale: 2, default: 10 })
  tvaRate: number;

  @Column({ name: 'montant_tva', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montantTva: number;

  @Column({ name: 'montant_ttc', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montantTtc: number;

  @Column({ name: 'remise_globale', type: 'decimal', precision: 5, scale: 2, default: 0 })
  remiseGlobale: number;

  @Column({ name: 'duree_jours', type: 'int', nullable: true })
  dureeJours: number;

  @Column({ name: 'date_debut', type: 'date', nullable: true })
  dateDebut: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin: Date;

  @Column({ name: 'date_validite', type: 'date', nullable: true })
  dateValidite: Date;

  @Column({ name: 'notes_internes', type: 'text', nullable: true })
  notesInternes: string;

  @Column({ name: 'conditions_paiement', nullable: true })
  conditionsPaiement: string;

  @Column({ name: 'acompte_percent', type: 'decimal', precision: 5, scale: 2, default: 30 })
  acomptePercent: number;

  @Column({ name: 'ai_generated', default: false })
  aiGenerated: boolean;

  @Column({ name: 'ai_model', nullable: true })
  aiModel: string;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

  @Column({ name: 'signature_status', nullable: true })
  signatureStatus: string;

  @Column({ name: 'signature_request_id', nullable: true })
  signatureRequestId: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ name: 'accepted_at', nullable: true })
  acceptedAt: Date;

  @OneToMany(() => DevisLigne, (ligne) => ligne.devis, { cascade: true, eager: false })
  lignes: DevisLigne[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
