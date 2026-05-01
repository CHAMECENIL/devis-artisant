import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { GedService } from './ged.service';
import { RequestUploadUrlDto } from './dto/document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('GED')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ged')
export class GedController {
  constructor(private readonly gedService: GedService) {}

  @Post('upload-url')
  requestUploadUrl(@Body() dto: RequestUploadUrlDto, @CurrentTenant() tenant: any, @CurrentUser() user: any) {
    return this.gedService.requestUploadUrl(dto, tenant.id, user.sub);
  }

  @Get()
  findAll(@CurrentTenant() tenant: any, @Query('devisId') devisId?: string, @Query('clientId') clientId?: string) {
    return this.gedService.findAll(tenant.id, devisId, clientId);
  }

  @Get(':id/download')
  async getDownloadUrl(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    const url = await this.gedService.getDownloadUrl(id, tenant.id);
    return { url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.gedService.remove(id, tenant.id);
  }
}
