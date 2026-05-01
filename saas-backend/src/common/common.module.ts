import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { PlanGuard } from './guards/plan.guard';
import { TenantQuotaGuard } from './guards/tenant-quota.guard';

// Interceptors
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';

// Utils / Services
import { EncryptionService } from './utils/encryption.util';

/**
 * CommonModule — couche transversale SaaS multi-tenant.
 *
 * Décoré @Global() pour que les guards, interceptors et services soient
 * disponibles dans tous les modules sans réimportation explicite.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    // TypeORM DataSource est fourni globalement par TypeOrmModule.forRoot()
    // dans AppModule — pas besoin de le réimporter ici.
  ],
  providers: [
    // Guards
    JwtAuthGuard,
    AdminJwtGuard,
    RolesGuard,
    PlanGuard,
    TenantQuotaGuard,

    // Interceptors
    TenantContextInterceptor,
    AuditInterceptor,

    // Services utilitaires
    EncryptionService,
  ],
  exports: [
    // Guards
    JwtAuthGuard,
    AdminJwtGuard,
    RolesGuard,
    PlanGuard,
    TenantQuotaGuard,

    // Interceptors
    TenantContextInterceptor,
    AuditInterceptor,

    // Services
    EncryptionService,
  ],
})
export class CommonModule {}
