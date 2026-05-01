import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

class InitiateSignatureDto {
  @IsEmail() signerEmail: string;
  @IsString() signerName: string;
}

class VerifySignatureDto {
  @IsString() token: string;
}

@ApiTags('Signature')
@Controller('signature')
export class SignatureController {
  constructor(private readonly signatureService: SignatureService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('devis/:id/initiate')
  initiateSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateSignatureDto,
    @CurrentTenant() tenant: any,
  ) {
    return this.signatureService.initiateSignature(id, dto.signerEmail, dto.signerName, tenant);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('devis/:id/status')
  getStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenant: any) {
    return this.signatureService.getSignatureStatus(id, tenant.id);
  }

  @Public()
  @Post('devis/:id/verify')
  verifySignature(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifySignatureDto,
  ) {
    // tenantId extracted from devis directly (no auth needed for public signing page)
    return this.signatureService.verifySignature(id, dto.token, '');
  }
}
