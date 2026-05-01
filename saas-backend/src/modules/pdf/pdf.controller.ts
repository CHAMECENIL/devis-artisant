import { Controller, Get, Param, Res, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { DevisService } from '../devis/devis.service';
import { AiService } from '../ai/ai.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('PDF')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly devisService: DevisService,
    private readonly aiService: AiService,
  ) {}

  @Get('devis/:id')
  async downloadDevis(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any, @Res() res: Response) {
    const devis = await this.devisService.findOne(id, tenant.id);
    const pdf = await this.pdfService.generateDevisPdf(devis, tenant);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="devis-${devis.numero}.pdf"`);
    res.send(pdf);
  }

  @Get('rentabilite/:id')
  async downloadRentabilite(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any, @Res() res: Response) {
    const devis = await this.devisService.findOne(id, tenant.id);
    const data = await this.aiService.estimerRentabilite(devis, tenant);
    const pdf = await this.pdfService.generateRentabilitePdf({ ...data, devisNumero: devis.numero }, tenant);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rentabilite-${devis.numero}.pdf"`);
    res.send(pdf);
  }
}
