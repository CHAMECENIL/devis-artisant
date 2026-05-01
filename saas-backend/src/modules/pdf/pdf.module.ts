import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { DevisModule } from '../devis/devis.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DevisModule, AiModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
