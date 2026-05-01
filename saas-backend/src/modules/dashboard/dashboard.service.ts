import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(private dataSource: DataSource) {}

  async getAnalytics(tenantId: string, period: 'month' | 'quarter' | 'year' = 'month') {
    const periodSql = period === 'month' ? "date_trunc('month', NOW())"
      : period === 'quarter' ? "date_trunc('quarter', NOW())"
      : "date_trunc('year', NOW())";

    const [kpis, byStatut, evolution, topClients, recentDevis] = await Promise.all([
      this.getKpis(tenantId, periodSql, period),
      this.getByStatut(tenantId),
      this.getEvolution(tenantId),
      this.getTopClients(tenantId),
      this.getRecentDevis(tenantId),
    ]);

    return { kpis, byStatut, evolution, topClients, recentDevis };
  }

  private async getKpis(tenantId: string, periodSql: string, period: 'month' | 'quarter' | 'year') {
    const [current, previous, allTime] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as total,
               COALESCE(SUM(CASE WHEN statut='accepte' THEN montant_ttc ELSE 0 END),0) as accepted_total,
               COUNT(CASE WHEN statut='accepte' THEN 1 END) as accepted_count
        FROM devis WHERE tenant_id=$1 AND created_at >= ${periodSql}
      `, [tenantId]),
      this.dataSource.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as total
        FROM devis WHERE tenant_id=$1 AND created_at >= ${periodSql} - INTERVAL '1 ${period === 'month' ? 'month' : period === 'quarter' ? '3 months' : 'year'}'
          AND created_at < ${periodSql}
      `, [tenantId]),
      this.dataSource.query(`
        SELECT COALESCE(SUM(CASE WHEN statut='accepte' THEN montant_ttc ELSE 0 END),0) as ca_total,
               COUNT(CASE WHEN statut='accepte' THEN 1 END) as devis_acceptes,
               COUNT(*) as devis_total
        FROM devis WHERE tenant_id=$1
      `, [tenantId]),
    ]);

    const curr = current[0];
    const prev = previous[0];
    const all = allTime[0];

    return {
      devisCount: Number(curr.count),
      devisTotal: Number(curr.total),
      acceptedCount: Number(curr.accepted_count),
      acceptedTotal: Number(curr.accepted_total),
      tauxConversion: Number(curr.count) > 0 ? Math.round((Number(curr.accepted_count) / Number(curr.count)) * 100) : 0,
      evolutionCount: Number(prev.count) > 0 ? Math.round(((Number(curr.count) - Number(prev.count)) / Number(prev.count)) * 100) : 0,
      evolutionTotal: Number(prev.total) > 0 ? Math.round(((Number(curr.total) - Number(prev.total)) / Number(prev.total)) * 100) : 0,
      allTimeCa: Number(all.ca_total),
      allTimeAcceptes: Number(all.devis_acceptes),
      allTimeTotal: Number(all.devis_total),
    };
  }

  private async getByStatut(tenantId: string) {
    return this.dataSource.query(`
      SELECT statut, COUNT(*) as count, COALESCE(SUM(montant_ttc),0) as total
      FROM devis WHERE tenant_id=$1
      GROUP BY statut ORDER BY count DESC
    `, [tenantId]);
  }

  private async getEvolution(tenantId: string) {
    return this.dataSource.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
             COUNT(*) as count,
             COALESCE(SUM(montant_ttc),0) as total,
             COALESCE(SUM(CASE WHEN statut='accepte' THEN montant_ttc ELSE 0 END),0) as accepted
      FROM devis WHERE tenant_id=$1 AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month ORDER BY month ASC
    `, [tenantId]);
  }

  private async getTopClients(tenantId: string) {
    return this.dataSource.query(`
      SELECT client_name, COUNT(*) as devis_count,
             COALESCE(SUM(CASE WHEN statut='accepte' THEN montant_ttc ELSE 0 END),0) as ca
      FROM devis WHERE tenant_id=$1
      GROUP BY client_name ORDER BY ca DESC LIMIT 10
    `, [tenantId]);
  }

  private async getRecentDevis(tenantId: string) {
    return this.dataSource.query(`
      SELECT id, numero, client_name, montant_ttc, statut, created_at
      FROM devis WHERE tenant_id=$1
      ORDER BY created_at DESC LIMIT 5
    `, [tenantId]);
  }
}
