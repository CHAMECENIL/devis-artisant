import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminJwtPayload } from '../../common/types/tenant-request.interface';

import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto, AdminVerify2faDto } from './dto/admin-login.dto';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // ─── Login (étape 1 : mot de passe) ─────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Connexion admin — retourne un tempToken pour la 2FA' })
  @ApiResponse({ status: 200, description: 'Mot de passe valide — SMS envoyé' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  @ApiResponse({ status: 429, description: 'Compte verrouillé' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  // ─── Verify 2FA (étape 2 : code SMS) ─────────────────────────────────────────

  @Public()
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Valider le code OTP SMS pour obtenir le token admin final' })
  @ApiResponse({ status: 200, description: 'Authentification réussie — accessToken admin retourné' })
  @ApiResponse({ status: 401, description: 'Code invalide, expiré ou tempToken invalide' })
  verify2fa(@Body() dto: AdminVerify2faDto) {
    return this.adminAuthService.verify2fa(dto);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnecter l\'administrateur (stateless)' })
  @ApiResponse({ status: 200, description: 'Déconnecté' })
  logout() {
    return this.adminAuthService.logout();
  }

  // ─── Me ───────────────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l\'administrateur connecté' })
  @ApiResponse({ status: 200, description: 'Payload JWT admin' })
  @ApiResponse({ status: 401, description: 'Non authentifié ou scope incorrect' })
  getMe(@Req() req: Request & { user: AdminJwtPayload }) {
    return { admin: req.user };
  }
}
