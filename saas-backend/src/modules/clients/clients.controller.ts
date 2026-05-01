import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/tenant-request.interface';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto/client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les clients du tenant' })
  findAll(@CurrentUser() user: JwtPayload, @Query() filter: ClientFilterDto) {
    return this.clientsService.findAll(user.tenantId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail client + historique devis' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un client' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: JwtPayload) {
    return this.clientsService.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un client' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: JwtPayload) {
    return this.clientsService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un client' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.remove(id, user.tenantId);
  }
}
