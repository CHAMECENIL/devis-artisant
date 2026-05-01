import { Controller, Get, Post, Body, Headers, RawBodyRequest, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

class CreateCheckoutDto {
  @IsString() planId: string;
  @IsUrl() successUrl: string;
  @IsUrl() cancelUrl: string;
}

class PortalDto {
  @IsUrl() returnUrl: string;
}

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(@Body() dto: CreateCheckoutDto, @CurrentTenant() tenant: any) {
    const url = await this.billingService.createCheckoutSession(tenant.id, dto.planId, dto.successUrl, dto.cancelUrl);
    return { url };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('invoices')
  getInvoices(@CurrentTenant() tenant: any) {
    return this.billingService.getInvoices(tenant.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async getPortal(@Body() dto: PortalDto, @CurrentTenant() tenant: any) {
    const url = await this.billingService.getPortalUrl(tenant.id, dto.returnUrl);
    return { url };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    await this.billingService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return { received: true };
  }
}
