import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantQuotaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant) {
      throw new ForbiddenException('Contexte tenant introuvable');
    }

    // max_devis_per_month = -1 signifie illimité
    const maxDevisPerMonth = tenant.max_devis_per_month;

    if (
      maxDevisPerMonth !== -1 &&
      maxDevisPerMonth !== null &&
      maxDevisPerMonth !== undefined &&
      tenant.devis_count_this_month >= maxDevisPerMonth
    ) {
      throw new ForbiddenException(
        `Quota mensuel de devis atteint (${maxDevisPerMonth} devis/mois). Passez à un plan supérieur pour continuer.`,
      );
    }

    return true;
  }
}
