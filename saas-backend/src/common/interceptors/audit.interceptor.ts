import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method?.toUpperCase();

    // On n'audite que les mutations
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const actorId: string | null =
      request.user?.sub ?? request.admin?.sub ?? null;

    const tenantId: string | null = request.user?.tenantId ?? null;

    const action = `${method}:${request.route?.path ?? request.url}`;

    const ipAddress: string =
      request.ip ??
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      'unknown';

    const userAgent: string = request.headers['user-agent'] ?? null;

    const startedAt = new Date();

    return next.handle().pipe(
      tap({
        next: () => {
          // Insertion asynchrone — on ne bloque pas la réponse
          this.insertAuditLog({
            actorId,
            tenantId,
            action,
            ipAddress,
            userAgent,
            status: 'success',
            startedAt,
          }).catch((err) => {
            console.error('[AuditInterceptor] Erreur insertion audit_logs:', err);
          });
        },
        error: (err) => {
          this.insertAuditLog({
            actorId,
            tenantId,
            action,
            ipAddress,
            userAgent,
            status: 'error',
            errorMessage: err?.message ?? String(err),
            startedAt,
          }).catch((insertErr) => {
            console.error('[AuditInterceptor] Erreur insertion audit_logs (on error):', insertErr);
          });
        },
      }),
    );
  }

  private async insertAuditLog(params: {
    actorId: string | null;
    tenantId: string | null;
    action: string;
    ipAddress: string;
    userAgent: string | null;
    status: 'success' | 'error';
    errorMessage?: string;
    startedAt: Date;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO audit_logs
         (actor_id, tenant_id, action, ip_address, user_agent, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.actorId,
        params.tenantId,
        params.action,
        params.ipAddress,
        params.userAgent,
        params.status,
        params.errorMessage ?? null,
        params.startedAt.toISOString(),
      ],
    );
  }
}
