import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Devis } from './devis.entity';

export enum LigneType {
  MAIN_OEUVRE = 'main_oeuvre',
  MATERIAU = 'materiau',
  FOURNITURE = 'fourniture',
  DEPLACEMENT = 'deplacement',
  SOUS_TRAITANCE = 'sous_traitance',
}

@Entity('devis_lignes')
export class DevisLigne {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'devis_id' })
  devisId: string;

  @ManyToOne(() => Devis, (devis) => devis.lignes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'devis_id' })
  devis: Devis;

  @Column({ type: 'int', default: 0 })
  ordre: number;

  @Column({ type: 'varchar', enum: LigneType, default: LigneType.MATERIAU })
  type: LigneType;

  @Column()
  designation: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  unite: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 1 })
  quantite: number;

  @Column({ name: 'prix_unitaire_ht', type: 'decimal', precision: 10, scale: 2 })
  prixUnitaireHt: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  remise: number;

  @Column({ name: 'montant_ht', type: 'decimal', precision: 10, scale: 2 })
  montantHt: number;

  @Column({ name: 'tva_rate', type: 'decimal', precision: 5, scale: 2, default: 10 })
  tvaRate: number;

  @Column({ name: 'fournisseur', nullable: true })
  fournisseur: string;

  @Column({ name: 'reference_fournisseur', nullable: true })
  referenceFournisseur: string;

  @Column({ name: 'prix_achat_ht', type: 'decimal', precision: 10, scale: 2, nullable: true })
  prixAchatHt: number;

  @Column({ name: 'is_option', default: false })
  isOption: boolean;
}
