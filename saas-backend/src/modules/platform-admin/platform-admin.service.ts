import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard() {
    const [totalTenants, byStatus, mrr, newThisMonthRows] = await Promise.all([
      this.tenantRepo.count(),
      this.dataSource.query(`
        SELECT status, COUNT(*) as count
        FROM tenants GROUP BY status
      `),
      this.dataSource.query(`
        SELECT COALESCE(SUM(sp.priceMonthly), 0) as mrr
        FROM tenants t
        JOIN subscription_plans sp ON t.planId = sp.id
        WHERE t.status = 'active'
      `),
      this.dataSource.query(`
        SELECT COUNT(*) as count FROM tenants
        WHERE strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')
      `),
    ]);

    const byPlan = await this.dataSource.query(`
      SELECT sp.name, sp.label, COUNT(t.id) as count
      FROM subscription_plans sp
      LEFT JOIN tenants t ON t.planId = sp.id AND t.status = 'active'
      GROUP BY sp.id, sp.name, sp.label
      ORDER BY sp.priceMonthly
    `);

    const mrrValue = parseFloat(mrr[0]?.mrr || '0');
    return {
      totalTenants,
      byStatus: byStatus.reduce((acc: any, r: any) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
      byPlan,
      mrr: mrrValue,
      arr: mrrValue * 12,
      newThisMonth: parseInt(newThisMonthRows[0]?.count || '0'),
    };
  }

  async getAuditLogs(filter: { tenantId?: string; action?: string; page?: number; limit?: number }) {
    // audit_logs table may not exist in dev/SQLite — return empty gracefully
    const tableExists = await this.dataSource.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'`,
    ).catch(() => []);
    if (!tableExists.length) {
      return { data: [], total: 0, page: filter.page || 1, limit: filter.limit || 50 };
    }

    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.tenantId) { conditions.push('al.tenantId = ?'); params.push(filter.tenantId); }
    if (filter.action) { conditions.push('al.action LIKE ?'); params.push(`%${filter.action}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT al.*, t.companyName as tenantName
         FROM audit_logs al
         LEFT JOIN tenants t ON al.tenantId = t.id
         ${where}
         ORDER BY al.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM audit_logs al ${where}`,
        params,
      ),
    ]);

    return { data: rows, total: parseInt(countResult[0]?.count || '0'), page, limit };
  }

  async impersonate(tenantId: string, adminId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant introuvable');
    if (!['active', 'trial'].includes(tenant.status)) {
      throw new ForbiddenException('Ce tenant est suspendu');
    }

    const owner = await this.userRepo.findOne({
      where: { tenantId, role: 'owner', isActive: true },
    });
    if (!owner) throw new NotFoundException('Aucun owner actif trouvé');

    // Token d'impersonation limité à 1h avec claim spécial
    const accessToken = this.jwtService.sign(
      { sub: owner.id, tenantId, role: owner.role, email: owner.email, isImpersonation: true, impersonatedBy: adminId },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );

    // Log dans audit_logs (si la table existe)
    await this.dataSource.query(
      `INSERT OR IGNORE INTO audit_logs (actorType, actorId, tenantId, action, resourceType, resourceId, details, createdAt)
       VALUES ('platform_admin', ?, ?, 'tenant.impersonate', 'tenant', ?, ?, datetime('now'))`,
      [adminId, tenantId, tenantId, JSON.stringify({ ownerId: owner.id, ownerEmail: owner.email })],
    ).catch(() => { /* audit_logs table may not exist in dev */ });

    return { accessToken, tenant: { id: tenant.id, companyName: tenant.companyName, slug: tenant.slug }, expiresIn: '1h' };
  }

  async updatePlan(tenantId: string, planId: string, billingCycle: string) {
    await this.tenantRepo.update(tenantId, { planId, billingCycle: billingCycle as any });
    return { message: 'Plan mis à jour' };
  }
}
