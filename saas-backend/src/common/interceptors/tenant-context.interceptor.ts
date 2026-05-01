import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;

    // Routes publiques sans tenant — on passe directement
    if (!tenantId) {
      return next.handle();
    }

    // Charge le tenant + son plan en une seule requête
    const rows: any[] = await this.dataSource.query(
      `SELECT t.*, sp.max_devis_per_month, sp.max_clients, sp.max_users,
              sp.has_ai_generation, sp.has_custom_pdf, sp.has_api_access,
              sp.has_signature_electronique, sp.has_relances_auto,
              sp.has_analytics_avancees, sp.has_export_comptable,
              sp.name AS plan_name
       FROM tenants t
       LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
       WHERE t.id = $1`,
      [tenantId],
    );

    if (!rows[0]) {
      throw new ForbiddenException('Tenant introuvable');
    }

    const tenant = rows[0];

    const allowedStatuses = ['active', 'trial'];
    if (!allowedStatuses.includes(tenant.status)) {
      throw new ForbiddenException(
        `Compte suspendu ou annulé (statut: ${tenant.status}). Contactez le support.`,
      );
    }

    // Attache le tenant enrichi à la requête
    request.tenant = tenant;

    // Active le Row-Level Security pour cette connexion
    // Note: SET LOCAL s'applique à la transaction en cours.
    // Pour les requêtes hors transaction, on utilise SET (sans LOCAL).
    await this.dataSource.query(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );

    return next.handle();
  }
}
