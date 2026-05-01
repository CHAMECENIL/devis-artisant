import { Controller, Post, Body, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Discuter avec l\'IA BTP' })
  chat(@Body() dto: ChatDto, @CurrentTenant() tenant: any) {
    return this.aiService.chat(dto, tenant);
  }

  @Post('challenge/:devisId')
  @ApiOperation({ summary: 'Challenger le chiffrage d\'un devis' })
  challenge(@Param('devisId', ParseUUIDPipe) devisId: string, @Body() body: any, @CurrentTenant() tenant: any) {
    return this.aiService.challengeChiffrage(body, tenant);
  }

  @Post('rentabilite')
  @ApiOperation({ summary: 'Estimer la rentabilité d\'un devis' })
  rentabilite(@Body() body: any, @CurrentTenant() tenant: any) {
    return this.aiService.estimerRentabilite(body, tenant);
  }
}
