import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { PlatformAdminService } from './platform-admin.service';
import { IsOptional, IsString, IsUUID } from 'class-validator';

class UpdatePlanDto {
  @IsUUID() planId: string;
  @IsString() billingCycle: string;
}

class AuditFilterDto {
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

@ApiTags('Admin Plateforme')
@ApiSecurity('admin-jwt')
@UseGuards(AdminJwtGuard)
@Controller('admin')
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Statistiques globales plateforme' })
  getDashboard() {
    return this.service.getDashboard();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Journal d\'audit' })
  getAuditLogs(@Query() filter: AuditFilterDto) {
    return this.service.getAuditLogs(filter);
  }

  @Post('tenants/:id/impersonate')
  @ApiOperation({ summary: 'Usurper l\'identité d\'un tenant (1h)' })
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('adminId') adminId: string,
  ) {
    return this.service.impersonate(id, adminId);
  }

  @Patch('tenants/:id/plan')
  @ApiOperation({ summary: 'Changer le plan d\'un tenant' })
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(id, dto.planId, dto.billingCycle);
  }
}
