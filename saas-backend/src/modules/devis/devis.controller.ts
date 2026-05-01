import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, Res, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { DevisService } from './devis.service';
import { CreateDevisDto, UpdateDevisDto, GenerateDevisDto, DevisFilterDto, SendDevisDto } from './dto/devis.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantQuotaGuard } from '../../common/guards/tenant-quota.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Devis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devis')
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques devis du tenant' })
  getStats(@CurrentTenant() tenant: any) {
    return this.devisService.getStats(tenant.id);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des devis' })
  findAll(@CurrentTenant() tenant: any, @Query() filter: DevisFilterDto) {
    return this.devisService.findAll(tenant.id, filter);
  }

  @Post()
  @UseGuards(TenantQuotaGuard)
  @ApiOperation({ summary: 'Créer un devis manuellement' })
  create(@Body() dto: CreateDevisDto, @CurrentTenant() tenant: any) {
    return this.devisService.create(dto, tenant.id);
  }

  @Post('generate')
  @UseGuards(TenantQuotaGuard)
  @ApiOperation({ summary: 'Générer un devis avec l\'IA' })
  generateWithAI(@Body() dto: GenerateDevisDto, @CurrentTenant() tenant: any) {
    return this.devisService.generateWithAI(dto, tenant);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.devisService.findOne(id, tenant.id);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDevisDto, @CurrentTenant() tenant: any) {
    return this.devisService.update(id, dto, tenant.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.devisService.remove(id, tenant.id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.devisService.duplicate(id, tenant.id);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendByEmail(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendDevisDto, @CurrentTenant() tenant: any) {
    return this.devisService.sendByEmail(id, dto, tenant.id);
  }

  @Get(':id/liste-achats')
  getListeAchats(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.devisService.getListeAchats(id, tenant.id);
  }

  @Get(':id/liste-achats/csv')
  async exportListeAchatsCsv(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any, @Res() res: Response) {
    const csv = await this.devisService.exportListeAchatsCsv(id, tenant.id);
    const devis = await this.devisService.findOne(id, tenant.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="liste-achats-${devis.numero}.csv"`);
    res.send('\uFEFF' + csv);
  }
}
