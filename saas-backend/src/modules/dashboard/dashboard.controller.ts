import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';

class DashboardQueryDto {
  @IsOptional() @IsEnum(['month', 'quarter', 'year']) period?: 'month' | 'quarter' | 'year' = 'month';
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getAnalytics(@CurrentTenant() tenant: any, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getAnalytics(tenant.id, query.period);
  }
}
