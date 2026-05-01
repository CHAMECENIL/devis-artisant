import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantFilterDto } from './dto/tenant-filter.dto';

@ApiTags('Admin — Tenants')
@Controller('admin/tenants')
@UseGuards(AdminJwtGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ─── GET /admin/tenants ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Liste paginée des tenants avec filtres' })
  findAll(@Query() filter: TenantFilterDto) {
    return this.tenantsService.findAll(filter);
  }

  // ─── GET /admin/tenants/stats ──────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales de la plateforme' })
  getStats() {
    return this.tenantsService.getStats();
  }

  // ─── GET /admin/tenants/:id ────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un tenant avec son plan et ses stats' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  // ─── POST /admin/tenants ───────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau tenant + utilisateur owner' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  // ─── PATCH /admin/tenants/:id ──────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un tenant' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  // ─── DELETE /admin/tenants/:id ─────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Annuler un tenant (soft delete)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.delete(id);
  }

  // ─── POST /admin/tenants/:id/suspend ──────────────────────────────────────

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspendre un tenant' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.tenantsService.suspend(id, reason ?? 'Suspension administrative');
  }

  // ─── POST /admin/tenants/:id/reactivate ───────────────────────────────────

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Réactiver un tenant suspendu' })
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.reactivate(id);
  }

  // ─── POST /admin/tenants/:id/resend-validation ────────────────────────────

  @Post(':id/resend-validation')
  @ApiOperation({ summary: 'Renvoyer l\'email de validation au owner' })
  resendValidation(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.resendValidation(id);
  }

  // ─── POST /admin/tenants/:id/reset-password ───────────────────────────────

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Générer un mot de passe temporaire pour le owner' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('sendByEmail') sendByEmail: boolean,
  ) {
    return this.tenantsService.resetPassword(id, sendByEmail ?? true);
  }
}
