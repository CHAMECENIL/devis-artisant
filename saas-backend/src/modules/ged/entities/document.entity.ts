import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export enum DocumentType {
  DEVIS = 'devis',
  FACTURE = 'facture',
  BON_COMMANDE = 'bon_commande',
  ATTESTATION = 'attestation',
  PHOTO = 'photo',
  CONTRAT = 'contrat',
  AUTRE = 'autre',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'devis_id', nullable: true })
  devisId: string;

  @Column({ name: 'client_id', nullable: true })
  clientId: string;

  @Column()
  name: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ type: 'varchar', enum: DocumentType, default: DocumentType.AUTRE })
  type: DocumentType;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
