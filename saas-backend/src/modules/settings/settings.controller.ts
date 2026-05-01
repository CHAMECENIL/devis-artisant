import { Controller, Get, Patch, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/tenant-request.interface';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class TestMapsDto {
  @ApiPropertyOptional() @IsString() origin: string;
  @ApiPropertyOptional() @IsString() destination: string;
}

@ApiTags('Paramètres')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Lire les paramètres du tenant' })
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.settingsService.getSettings(user.tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Mettre à jour les paramètres' })
  updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(user.tenantId, dto);
  }

  @Post('test-ai')
  @ApiOperation({ summary: 'Tester la connexion IA Anthropic' })
  testAI(@CurrentUser() user: JwtPayload) {
    return this.settingsService.testAI(user.tenantId);
  }

  @Post('test-smtp')
  @ApiOperation({ summary: 'Tester la connexion SMTP' })
  testSmtp(@CurrentUser() user: JwtPayload) {
    return this.settingsService.testSmtp(user.tenantId);
  }

  @Post('test-maps')
  @ApiOperation({ summary: 'Tester Google Maps Distance Matrix' })
  testMaps(@CurrentUser() user: JwtPayload, @Body() dto: TestMapsDto) {
    return this.settingsService.testMaps(user.tenantId, dto.origin, dto.destination);
  }
}
