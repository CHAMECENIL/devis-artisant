import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/tenant-request.interface';

import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ChangePasswordDto } from '../auth/dto/reset-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister tous les utilisateurs du tenant' })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findAllByTenant(user.tenantId);
  }

  // ─── POST /users/invite ───────────────────────────────────────────────────────

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Inviter un nouvel utilisateur dans le tenant' })
  @ApiResponse({ status: 201, description: 'Invitation envoyée' })
  @ApiResponse({ status: 400, description: 'Email déjà utilisé dans ce tenant' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  invite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.inviteUser(user.tenantId, dto.email, dto.role);
  }

  // ─── PATCH /users/:id/role ────────────────────────────────────────────────────

  @Patch(':id/role')
  @Roles('owner')
  @ApiOperation({ summary: 'Modifier le rôle d\'un utilisateur (owner uniquement)' })
  @ApiParam({ name: 'id', type: String, description: 'UUID de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.update(id, { role: dto.role });
  }

  // ─── DELETE /users/:id ────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner')
  @ApiOperation({ summary: 'Désactiver un utilisateur (owner uniquement)' })
  @ApiParam({ name: 'id', type: String, description: 'UUID de l\'utilisateur' })
  @ApiResponse({ status: 204, description: 'Utilisateur désactivé' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Empêcher l'owner de se supprimer lui-même
    if (id === user.sub) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }
    await this.usersService.deactivate(id);
  }

  // ─── PATCH /users/me ──────────────────────────────────────────────────────────

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour son propre profil' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour' })
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.sub, dto);
  }

  // ─── POST /users/me/change-password ───────────────────────────────────────────

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son mot de passe' })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié' })
  @ApiResponse({ status: 403, description: 'Mot de passe actuel incorrect' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
