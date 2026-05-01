import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Devis, DevisStatut } from './entities/devis.entity';
import { DevisLigne, LigneType } from './entities/devis-ligne.entity';
import { CreateDevisDto, UpdateDevisDto, GenerateDevisDto, DevisFilterDto, SendDevisDto } from './dto/devis.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Anthropic from '@anthropic-ai/sdk';
import { EncryptionService } from '../../common/utils/encryption.util';

@Injectable()
export class DevisService {
  constructor(
    @InjectRepository(Devis) private devisRepo: Repository<Devis>,
    @InjectRepository(DevisLigne) private ligneRepo: Repository<DevisLigne>,
    private dataSource: DataSource,
    @InjectQueue('email') private emailQueue: Queue,
    private encryptionService: EncryptionService,
  ) {}

  // ─── Numérotation ────────────────────────────────────────────────────────────
  private async generateNumero(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.devisRepo.count({ where: { tenantId } });
    const seq = String(count + 1).padStart(4, '0');
    return `DEV-${year}${month}-${seq}`;
  }

  // ─── Calcul montants ─────────────────────────────────────────────────────────
  private calculateTotals(lignes: Partial<DevisLigne>[], remiseGlobale = 0, tvaRate = 10) {
    let montantHt = 0;
    for (const l of lignes) {
      const remise = l.remise ?? 0;
      const montant = Number(l.quantite) * Number(l.prixUnitaireHt) * (1 - remise / 100);
      l.montantHt = Math.round(montant * 100) / 100;
      montantHt += l.montantHt;
    }
    const montantApresRemise = montantHt * (1 - remiseGlobale / 100);
    const montantTva = montantApresRemise * (tvaRate / 100);
    const montantTtc = montantApresRemise + montantTva;
    return {
      montantHt: Math.round(montantApresRemise * 100) / 100,
      montantTva: Math.round(montantTva * 100) / 100,
      montantTtc: Math.round(montantTtc * 100) / 100,
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filter: DevisFilterDto) {
    const { page = 1, limit = 20, search, statut, clientId } = filter;
    const qb = this.devisRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.client', 'client')
      .where('d.tenant_id = :tenantId', { tenantId })
      .orderBy('d.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) qb.andWhere('(d.numero ILIKE :s OR d.client_name ILIKE :s)', { s: `%${search}%` });
    if (statut) qb.andWhere('d.statut = :statut', { statut });
    if (clientId) qb.andWhere('d.client_id = :clientId', { clientId });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string): Promise<Devis> {
    const devis = await this.devisRepo.findOne({
      where: { id, tenantId },
      relations: ['lignes', 'client'],
      order: { lignes: { ordre: 'ASC' } },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    return devis;
  }

  async create(dto: CreateDevisDto, tenantId: string): Promise<Devis> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const numero = await this.generateNumero(tenantId);
      const lignes: Partial<DevisLigne>[] = (dto.lignes ?? []).map((l, i) => ({
        ...l,
        tenantId,
        ordre: l.ordre ?? i,
        montantHt: 0,
      }));
      const totals = this.calculateTotals(lignes, dto.remiseGlobale, dto.tvaRate ?? 10);

      const devis = qr.manager.create(Devis, {
        tenantId,
        numero,
        clientId: dto.clientId,
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        clientPhone: dto.clientPhone,
        clientAddress: dto.clientAddress,
        description: dto.description,
        projectType: dto.projectType,
        tvaRate: dto.tvaRate ?? 10,
        remiseGlobale: dto.remiseGlobale ?? 0,
        dureeJours: dto.dureeJours,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateValidite: dto.dateValidite ? new Date(dto.dateValidite) : undefined,
        notesInternes: dto.notesInternes,
        conditionsPaiement: dto.conditionsPaiement,
        acomptePercent: dto.acomptePercent ?? 30,
        ...totals,
        statut: DevisStatut.BROUILLON,
      });

      const savedDevis = await qr.manager.save(devis);

      if (lignes.length) {
        const ligneEntities = lignes.map(l => qr.manager.create(DevisLigne, { ...l, devisId: savedDevis.id }));
        await qr.manager.save(ligneEntities);
      }

      await qr.commitTransaction();
      return this.findOne(savedDevis.id, tenantId);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async update(id: string, dto: UpdateDevisDto, tenantId: string): Promise<Devis> {
    const devis = await this.findOne(id, tenantId);
    if (devis.statut === DevisStatut.ACCEPTE && !dto.statut) {
      throw new ForbiddenException('Un devis accepté ne peut plus être modifié');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      if (dto.lignes !== undefined) {
        await qr.manager.delete(DevisLigne, { devisId: id, tenantId });
        const lignes: Partial<DevisLigne>[] = dto.lignes.map((l, i) => ({ ...l, tenantId, devisId: id, ordre: l.ordre ?? i, montantHt: 0 }));
        const totals = this.calculateTotals(lignes, dto.remiseGlobale ?? devis.remiseGlobale, dto.tvaRate ?? Number(devis.tvaRate));
        await qr.manager.save(DevisLigne, lignes.map(l => qr.manager.create(DevisLigne, l)));
        Object.assign(devis, dto, totals);
      } else {
        Object.assign(devis, dto);
      }

      if (dto.dateDebut) devis.dateDebut = new Date(dto.dateDebut);
      if (dto.dateValidite) devis.dateValidite = new Date(dto.dateValidite);

      await qr.manager.save(devis);
      await qr.commitTransaction();
      return this.findOne(id, tenantId);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const devis = await this.findOne(id, tenantId);
    if (devis.statut === DevisStatut.ACCEPTE) throw new ForbiddenException('Impossible de supprimer un devis accepté');
    await this.devisRepo.remove(devis);
  }

  async duplicate(id: string, tenantId: string): Promise<Devis> {
    const original = await this.findOne(id, tenantId);
    const numero = await this.generateNumero(tenantId);
    const dto: CreateDevisDto = {
      clientName: original.clientName + ' (copie)',
      clientId: original.clientId,
      clientEmail: original.clientEmail,
      clientPhone: original.clientPhone,
      clientAddress: original.clientAddress,
      description: original.description,
      projectType: original.projectType,
      tvaRate: Number(original.tvaRate),
      remiseGlobale: Number(original.remiseGlobale),
      dureeJours: original.dureeJours,
      notesInternes: original.notesInternes,
      conditionsPaiement: original.conditionsPaiement,
      acomptePercent: Number(original.acomptePercent),
      lignes: original.lignes.map(l => ({
        type: l.type,
        designation: l.designation,
        description: l.description,
        unite: l.unite,
        quantite: Number(l.quantite),
        prixUnitaireHt: Number(l.prixUnitaireHt),
        remise: Number(l.remise),
        tvaRate: Number(l.tvaRate),
        fournisseur: l.fournisseur,
        referenceFournisseur: l.referenceFournisseur,
        prixAchatHt: l.prixAchatHt ? Number(l.prixAchatHt) : undefined,
        isOption: l.isOption,
        ordre: l.ordre,
      })),
    };
    return this.create(dto, tenantId);
  }

  // ─── Génération AI ────────────────────────────────────────────────────────────
  async generateWithAI(dto: GenerateDevisDto, tenant: any): Promise<Devis> {
    const systemPrompt = this.getBtpSystemPrompt();
    const userPrompt = `Client: ${dto.clientName}\nProjet: ${dto.description}`;

    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (tenant.anthropicKeyEncrypted) {
      try { apiKey = this.encryptionService.decrypt(tenant.anthropicKeyEncrypted); } catch {}
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new BadRequestException('Réponse AI invalide');

    const data = JSON.parse(jsonMatch[1]);
    const createDto: CreateDevisDto = {
      clientName: dto.clientName,
      clientId: dto.clientId,
      description: dto.description,
      projectType: data.projectType,
      tvaRate: data.tvaRate ?? 10,
      dureeJours: data.dureeJours,
      notesInternes: data.notesChantier,
      conditionsPaiement: data.conditionsPaiement ?? '30% acompte, solde à réception',
      acomptePercent: 30,
      lignes: (data.lignes ?? []).map((l: any, i: number) => ({
        type: l.type ?? LigneType.MATERIAU,
        designation: l.designation,
        description: l.description,
        unite: l.unite ?? 'u',
        quantite: l.quantite ?? 1,
        prixUnitaireHt: l.prixUnitaireHt ?? 0,
        remise: 0,
        tvaRate: l.tvaRate ?? 10,
        fournisseur: l.fournisseur,
        referenceFournisseur: l.reference,
        prixAchatHt: l.prixAchatHt,
        ordre: i,
        isOption: false,
      })),
    };

    const devis = await this.create(createDto, tenant.id);
    await this.devisRepo.update(devis.id, { aiGenerated: true, aiModel: 'claude-opus-4-5' });
    return this.findOne(devis.id, tenant.id);
  }

  private getBtpSystemPrompt(): string {
    return `Tu es un expert en chiffrage BTP français. Tu dois générer un devis ultra-détaillé avec TOUTES les fournitures et matériaux nécessaires.

Réponds UNIQUEMENT avec un JSON valide dans des balises \`\`\`json ... \`\`\`.

Format JSON requis:
{
  "projectType": "plomberie|electricite|maconnerie|peinture|menuiserie|carrelage|toiture|isolation|sdb|generique",
  "tvaRate": 10,
  "dureeJours": <nombre de jours ouvrés avec 15% contingence>,
  "notesChantier": "<remarques importantes, difficultés anticipées, conditions de chantier>",
  "conditionsPaiement": "30% acompte à la commande, 40% en cours de travaux, 30% à réception",
  "lignes": [
    {
      "type": "main_oeuvre|materiau|fourniture|deplacement|sous_traitance",
      "designation": "<désignation précise>",
      "description": "<description détaillée avec caractéristiques techniques>",
      "unite": "u|m|m2|m3|h|j|forfait|ml",
      "quantite": <nombre>,
      "prixUnitaireHt": <prix en euros>,
      "tvaRate": 10,
      "fournisseur": "<nom fournisseur recommandé: Leroy Merlin, Point P, Rexel, etc>",
      "reference": "<référence produit si connue>",
      "prixAchatHt": <prix d'achat estimé>
    }
  ]
}

RÈGLES IMPÉRATIVES:
1. Challenger le chiffrage: penser aux difficultés (accès, démolition préalable, évacuations, mise aux normes)
2. Lister TOUTES les fournitures (visserie, colle, joints, câbles, gaines, etc.)
3. Ajouter 15% de contingence sur la durée des travaux
4. Inclure ligne déplacement/frais de chantier
5. Séparer clairement main d'œuvre et matériaux
6. Prix réalistes marché français 2024`;
  }

  // ─── Liste de courses ─────────────────────────────────────────────────────────
  async getListeAchats(id: string, tenantId: string) {
    const devis = await this.findOne(id, tenantId);
    const materiaux = devis.lignes.filter(l => l.type === LigneType.MATERIAU || l.type === LigneType.FOURNITURE);

    const grouped: Record<string, any[]> = {};
    for (const m of materiaux) {
      const key = m.fournisseur ?? 'Autre';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        designation: m.designation,
        reference: m.referenceFournisseur,
        quantite: m.quantite,
        unite: m.unite,
        prixUnitaire: m.prixAchatHt ?? m.prixUnitaireHt,
        montantTotal: Number(m.quantite) * Number(m.prixAchatHt ?? m.prixUnitaireHt),
      });
    }

    const totalAchats = materiaux.reduce((s, m) => s + Number(m.quantite) * Number(m.prixAchatHt ?? m.prixUnitaireHt), 0);
    const totalVente = materiaux.reduce((s, m) => s + Number(m.montantHt), 0);

    return {
      devisNumero: devis.numero,
      clientName: devis.clientName,
      fournisseurs: grouped,
      totalAchats: Math.round(totalAchats * 100) / 100,
      totalVente: Math.round(totalVente * 100) / 100,
      margeEstimee: Math.round((totalVente - totalAchats) * 100) / 100,
    };
  }

  // ─── Export CSV liste de courses ──────────────────────────────────────────────
  async exportListeAchatsCsv(id: string, tenantId: string): Promise<string> {
    const liste = await this.getListeAchats(id, tenantId);
    const rows = ['Fournisseur;Désignation;Référence;Quantité;Unité;Prix Unitaire HT;Montant HT'];
    for (const [fournisseur, items] of Object.entries(liste.fournisseurs)) {
      for (const item of items) {
        rows.push([fournisseur, item.designation, item.reference ?? '', item.quantite, item.unite ?? '', item.prixUnitaire, item.montantTotal].join(';'));
      }
    }
    rows.push('');
    rows.push(`Total Achats;;;;;;${liste.totalAchats}`);
    rows.push(`Total Vente;;;;;;${liste.totalVente}`);
    rows.push(`Marge estimée;;;;;;${liste.margeEstimee}`);
    return rows.join('\n');
  }

  // ─── Envoi par email ──────────────────────────────────────────────────────────
  async sendByEmail(id: string, dto: SendDevisDto, tenantId: string): Promise<void> {
    const devis = await this.findOne(id, tenantId);
    await this.emailQueue.add('devis-sent', { devisId: id, email: dto.email, message: dto.message, devisNumero: devis.numero });
    await this.devisRepo.update(id, { statut: DevisStatut.ENVOYE, sentAt: new Date() });
  }

  // ─── Statistiques ─────────────────────────────────────────────────────────────
  async getStats(tenantId: string) {
    const stats = await this.devisRepo.createQueryBuilder('d')
      .select('d.statut', 'statut')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(d.montant_ttc)', 'total')
      .where('d.tenant_id = :tenantId', { tenantId })
      .groupBy('d.statut')
      .getRawMany();

    const thisMonth = await this.devisRepo.createQueryBuilder('d')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(d.montant_ttc)', 'total')
      .where('d.tenant_id = :tenantId AND d.created_at >= date_trunc(\'month\', NOW())', { tenantId })
      .getRawOne();

    return { byStatut: stats, thisMonth };
  }
}
