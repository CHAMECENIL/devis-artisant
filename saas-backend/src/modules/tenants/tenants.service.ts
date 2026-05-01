import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Tenant } from './entities/tenant.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { User } from '../users/entities/user.entity';
import { EncryptionService } from '../../common/utils/encryption.util';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantFilterDto } from './dto/tenant-filter.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly encryptionService: EncryptionService,
    private readonly dataSource: DataSource,

    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // FIND ALL — liste paginée avec filtres
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(filter: TenantFilterDto): Promise<PaginatedResult<any>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const offset = (page - 1) * limit;

    const qb = this.dataSource
      .createQueryBuilder()
      .select([
        't."id"',
        't."slug"',
        't."companyName"',
        't."companySiret"',
        't."companyPhone"',
        't."status"',
        't."planId"',
        't."trialEndsAt"',
        't."currentPeriodEnd"',
        't."devisCountThisMonth"',
        't."totalDevisGenerated"',
        't."totalTokensConsumed"',
        't."createdAt"',
        't."subscribedAt"',
        't."cancelledAt"',
        'sp.name AS "planName"',
        'sp.label AS "planLabel"',
        'sp."priceMonthly" AS "planPriceMonthly"',
        // Sous-requête pour récupérer l'email du owner
        `(SELECT u.email FROM users u WHERE u."tenantId" = t."id" AND u.role = 'owner' LIMIT 1) AS "ownerEmail"`,
      ])
      .from('tenants', 't')
      .leftJoin('subscription_plans', 'sp', 'sp.id = t."planId"');

    if (filter.search) {
      const term = `%${filter.search.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(t."companyName") LIKE :term OR t.slug LIKE :term OR EXISTS(
          SELECT 1 FROM users u2 WHERE u2."tenantId" = t.id AND LOWER(u2.email) LIKE :term
        ))`,
        { term },
      );
    }

    if (filter.status) {
      qb.andWhere('t.status = :status', { status: filter.status });
    }

    if (filter.planId) {
      qb.andWhere('t."planId" = :planId', { planId: filter.planId });
    }

    const total = await qb.getCount();

    const data = await qb
      .orderBy('t."createdAt"', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany();

    return paginate(data, total, filter);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FIND ONE — détail enrichi
  // ─────────────────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<any> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} introuvable`);
    }

    const plan = tenant.planId
      ? await this.planRepo.findOne({ where: { id: tenant.planId } })
      : null;

    const owner = await this.userRepo.findOne({
      where: { tenantId: id, role: 'owner' },
    });

    // Stats agrégées
    const statsRow = await this.dataSource.query(
      `SELECT COUNT(*) AS "devisCount"
       FROM devis
       WHERE tenant_id = ?`,
      [id],
    ).catch(() => [{ devisCount: 0 }]);

    return {
      ...tenant,
      plan,
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            firstName: owner.firstName,
            lastName: owner.lastName,
            isActive: owner.isActive,
            lastLoginAt: owner.lastLoginAt,
          }
        : null,
      stats: {
        totalDevis: Number(statsRow[0]?.devisCount ?? 0),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE — nouveau tenant + utilisateur owner
  // ─────────────────────────────────────────────────────────────────────────────

  async create(dto: CreateTenantDto): Promise<Tenant> {
    // 1. Vérifier unicité email (tous tenants confondus pour les owners)
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('Un compte avec cet email existe déjà');
    }

    // 2. Trouver le plan demandé ou bronze par défaut
    const planName = dto.planName ?? 'bronze';
    const plan = await this.planRepo.findOne({ where: { name: planName, isActive: true } });
    if (!plan && dto.planName) {
      throw new BadRequestException(`Plan "${dto.planName}" introuvable ou inactif`);
    }

    // 3. Générer un slug unique : slugify(companyName) + '-' + uuid[:8]
    const slug = this.buildSlug(dto.companyName);

    // 4. Calculer trial_ends_at
    const trialDays = dto.trialDays ?? 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // 5. Transaction atomique : créer tenant puis user
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // INSERT tenant
      const tenant = this.tenantRepo.create({
        slug,
        companyName: dto.companyName,
        companySiret: dto.companySiret,
        companyPhone: dto.companyPhone,
        status: 'trial',
        trialEndsAt,
        planId: plan?.id ?? null,
      });
      const savedTenant = await queryRunner.manager.save(Tenant, tenant);

      // INSERT user owner
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = this.userRepo.create({
        tenantId: savedTenant.id,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'owner',
        emailVerified: true, // L'admin crée le compte → considéré vérifié
        isActive: true,
      });
      await queryRunner.manager.save(User, user);

      await queryRunner.commitTransaction();

      this.logger.log(`Tenant créé : ${savedTenant.slug} (${savedTenant.id})`);
      return savedTenant;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} introuvable`);
    }

    const updateData: Partial<Tenant> = {};

    if (dto.companyName !== undefined) updateData.companyName = dto.companyName;
    if (dto.companySiret !== undefined) updateData.companySiret = dto.companySiret;
    if (dto.companyAddress !== undefined) updateData.companyAddress = dto.companyAddress;
    if (dto.companyPhone !== undefined) updateData.companyPhone = dto.companyPhone;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.planId !== undefined) updateData.planId = dto.planId;

    // Chiffrer IBAN si fourni en clair
    if (dto.ibanEncrypted !== undefined) {
      updateData.ibanEncrypted = this.encryptionService.encrypt(dto.ibanEncrypted);
    }

    // Recalculer trialEndsAt si trialDays fourni
    if (dto.trialDays !== undefined) {
      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + dto.trialDays);
      updateData.trialEndsAt = newTrialEnd;
    }

    await this.tenantRepo.update(id, updateData);
    return this.tenantRepo.findOne({ where: { id } }) as Promise<Tenant>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUSPEND
  // ─────────────────────────────────────────────────────────────────────────────

  async suspend(id: string, reason: string): Promise<{ message: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} introuvable`);
    }

    await this.tenantRepo.update(id, { status: 'suspended' });

    // Log audit
    await this.logAudit(id, 'tenant.suspend', 'system', { reason });

    // Envoyer email de suspension
    const owner = await this.userRepo.findOne({ where: { tenantId: id, role: 'owner' } });
    if (owner) {
      await this.emailQueue.add('tenant-suspended', {
        to: owner.email,
        tenantName: tenant.companyName,
        reason,
      });
    }

    this.logger.log(`Tenant ${id} suspendu. Raison: ${reason}`);
    return { message: 'Tenant suspendu avec succès' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REACTIVATE
  // ─────────────────────────────────────────────────────────────────────────────

  async reactivate(id: string): Promise<{ message: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} introuvable`);
    }

    await this.tenantRepo.update(id, { status: 'active' });

    // Log audit
    await this.logAudit(id, 'tenant.reactivate', 'system', {});

    // Envoyer email de réactivation
    const owner = await this.userRepo.findOne({ where: { tenantId: id, role: 'owner' } });
    if (owner) {
      await this.emailQueue.add('tenant-reactivated', {
        to: owner.email,
        tenantName: tenant.companyName,
      });
    }

    this.logger.log(`Tenant ${id} réactivé`);
    return { message: 'Tenant réactivé avec succès' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE (soft)
  // ─────────────────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<{ message: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} introuvable`);
    }

    await this.tenantRepo.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    this.logger.log(`Tenant ${id} annulé (soft delete)`);
    return { message: 'Tenant annulé' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESEND VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  async resendValidation(id: string): Promise<{ message: string }> {
    const owner = await this.userRepo.findOne({ where: { tenantId: id, role: 'owner' } });
    if (!owner) {
      throw new NotFoundException('Utilisateur owner introuvable pour ce tenant');
    }

    // Générer un nouveau token de validation
    const token = this.encryptionService.generateToken(32);
    const tokenHash = this.encryptionService.hashToken(token);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await this.userRepo.update(owner.id, {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: expires,
      emailVerified: false,
    });

    // Mettre en queue l'email de validation
    await this.emailQueue.add('email-verification', {
      to: owner.email,
      token,
      firstName: owner.firstName,
    });

    return { message: 'Email de validation renvoyé' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────

  async resetPassword(
    id: string,
    sendByEmail: boolean,
  ): Promise<{ tempPassword: string }> {
    const owner = await this.userRepo.findOne({ where: { tenantId: id, role: 'owner' } });
    if (!owner) {
      throw new NotFoundException('Utilisateur owner introuvable pour ce tenant');
    }

    // Générer un mot de passe temporaire (12 caractères alphanumériques)
    const rawToken = this.encryptionService.generateToken(8);
    const tempPassword = rawToken.substring(0, 12);
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const tempPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await this.userRepo.update(owner.id, {
      tempPasswordHash,
      tempPasswordExpires,
    });

    if (sendByEmail) {
      await this.emailQueue.add('temp-password', {
        to: owner.email,
        firstName: owner.firstName,
        tempPassword,
        expiresAt: tempPasswordExpires,
      });
    }

    return { tempPassword };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATS GLOBALES
  // ─────────────────────────────────────────────────────────────────────────────

  async getStats(): Promise<any> {
    const rows = await this.dataSource.query(`
      SELECT
        COUNT(*) AS "totalTenants",
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS "activeCount",
        SUM(CASE WHEN status = 'trial'     THEN 1 ELSE 0 END) AS "trialCount",
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS "suspendedCount",
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS "cancelledCount",
        SUM(CASE WHEN strftime('%Y-%m', "createdAt") = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END) AS "newThisMonth"
      FROM tenants
    `);

    const mrrRow = await this.dataSource.query(`
      SELECT COALESCE(SUM(sp."priceMonthly"), 0) AS mrr
      FROM tenants t
      JOIN subscription_plans sp ON sp.id = t."planId"
      WHERE t.status = 'active'
        AND (t."billingCycle" = 'monthly' OR t."billingCycle" IS NULL)
    `);

    const mrrAnnualRow = await this.dataSource.query(`
      SELECT COALESCE(SUM(sp."priceAnnual" / 12), 0) AS "mrrFromAnnual"
      FROM tenants t
      JOIN subscription_plans sp ON sp.id = t."planId"
      WHERE t.status = 'active'
        AND t."billingCycle" = 'annual'
    `);

    const byPlan = await this.dataSource.query(`
      SELECT sp.name AS "planName", sp.label AS "planLabel", COUNT(t.id) AS count
      FROM tenants t
      JOIN subscription_plans sp ON sp.id = t."planId"
      WHERE t.status IN ('active', 'trial')
      GROUP BY sp.name, sp.label
      ORDER BY sp.name
    `);

    const stats = rows[0];
    const mrr =
      Number(mrrRow[0]?.mrr ?? 0) + Number(mrrAnnualRow[0]?.mrrFromAnnual ?? 0);

    return {
      totalTenants: Number(stats.totalTenants),
      activeCount: Number(stats.activeCount),
      trialCount: Number(stats.trialCount),
      suspendedCount: Number(stats.suspendedCount),
      cancelledCount: Number(stats.cancelledCount),
      newThisMonth: Number(stats.newThisMonth),
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      byPlan: byPlan.map((r: any) => ({
        planName: r.planName,
        planLabel: r.planLabel,
        count: Number(r.count),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVÉS
  // ─────────────────────────────────────────────────────────────────────────────

  private buildSlug(companyName: string): string {
    const base = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);

    const suffix = this.encryptionService.generateToken(4).substring(0, 8);
    return `${base}-${suffix}`;
  }

  private async logAudit(
    tenantId: string,
    action: string,
    actorId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT OR IGNORE INTO audit_logs ("tenantId", action, "actorId", metadata, "createdAt")
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [tenantId, action, actorId, JSON.stringify(metadata)],
      );
    } catch {
      // Ne pas faire échouer l'opération principale si l'audit échoue
      this.logger.warn(`Audit log failed for action ${action} on tenant ${tenantId}`);
    }
  }
}
