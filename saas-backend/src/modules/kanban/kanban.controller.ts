import { Controller, Get, Put, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { KanbanService } from './kanban.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

class MoveCardDto {
  @IsString() column: string;
  @IsNumber() @Min(0) position: number;
}

class AcompteDto {
  @IsNumber() @Min(0) amount: number;
}

@ApiTags('Kanban')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kanban')
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  @Get()
  getBoard(@CurrentTenant() tenant: any) {
    return this.kanbanService.getBoard(tenant.id);
  }

  @Put(':id/move')
  moveCard(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveCardDto, @CurrentTenant() tenant: any) {
    return this.kanbanService.moveCard(id, dto.column, dto.position, tenant.id);
  }

  @Put(':id/acompte')
  setAcompte(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AcompteDto, @CurrentTenant() tenant: any) {
    return this.kanbanService.setAcompte(id, dto.amount, tenant.id);
  }
}
