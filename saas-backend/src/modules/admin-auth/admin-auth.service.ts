import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PlatformAdmin } from '../users/entities/platform-admin.entity';
import { EncryptionService } from '../../common/utils/encryption.util';
import { AdminLoginDto, AdminVerify2faDto } from './dto/admin-login.dto';

/** Token OTP valide 10 minutes */
const OTP_TTL_SECONDS = 600;

/** Nombre d'échecs avant verrouillage */
const MAX_FAILED_ATTEMPTS = 5;

/** Durée du verrouillage : 15 minutes en ms */
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  /** Fallback mémoire quand Redis est indisponible (dev/SQLite mode) */
  private readonly otpMemStore = new Map<string, { hash: string; expiresAt: number }>();

  constructor(
    @InjectRepository(PlatformAdmin)
    private readonly adminRepo: Repository<PlatformAdmin>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,

    // IORedis client injecté via token personnalisé
    @Inject('IOREDIS_CLIENT')
    private readonly redis: import('ioredis').Redis,
  ) {}

  /** Stocke un OTP : Redis si disponible, sinon Map en mémoire */
  private async otpSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } catch {
      this.otpMemStore.set(key, { hash: value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  /** Récupère un OTP : Redis si disponible, sinon Map en mémoire */
  private async otpGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      const entry = this.otpMemStore.get(key);
      if (!entry || entry.expiresAt < Date.now()) { this.otpMemStore.delete(key); return null; }
      return entry.hash;
    }
  }

  /** Supprime un OTP : Redis si disponible, sinon Map en mémoire */
  private async otpDel(key: string): Promise<void> {
    try { await this.redis.del(key); } catch { this.otpMemStore.delete(key); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — LOGIN (mot de passe → OTP SMS)
  // ─────────────────────────────────────────────────────────────────────────────

  async login(dto: AdminLoginDto): Promise<{
    requiresTwoFactor: boolean;
    tempToken: string;
    message: string;
    devOtp?: string;
  }> {
    const admin = await this.adminRepo.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });

    if (!admin) {
      // Délai artificiel anti-timing : 200ms
      await new Promise((resolve) => setTimeout(resolve, 200));
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Vérifier si le compte est verrouillé
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new HttpException(
        'Compte verrouillé — réessayez dans quelques minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.passwordHash);

    if (!passwordValid) {
      const newFailCount = admin.failedLoginCount + 1;
      const updateData: Partial<PlatformAdmin> = { failedLoginCount: newFailCount };

      if (newFailCount >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        this.logger.warn(`Admin ${admin.email} verrouillé après ${newFailCount} tentatives`);
      }

      await this.adminRepo.update(admin.id, updateData);
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Générer un OTP à 6 chiffres cryptographiquement sûr
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = this.encryptionService.hashToken(otp);
    const redisKey = `otp:admin:${admin.id}`;

    // Stocker le hash (Redis ou mémoire en dev)
    await this.otpSet(redisKey, otpHash, OTP_TTL_SECONDS);

    // Déterminer si le SMS sera réellement envoyé (même logique que sendOtpSms)
    const twilioSid   = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioFrom  = this.configService.get<string>('TWILIO_FROM');
    const smsWillBeSent = !!(twilioSid && twilioToken && twilioFrom && admin.smsPhone);

    await this.sendOtpSms(admin.smsPhone, otp);

    // Générer un tempToken JWT (scope: 2fa-pending, durée: 5 minutes)
    const tempToken = this.jwtService.sign(
      { sub: admin.id, scope: '2fa-pending', email: admin.email },
      {
        secret: this.configService.get<string>('jwt.adminSecret'),
        expiresIn: '5m',
      },
    );

    return {
      requiresTwoFactor: true,
      tempToken,
      message: 'Code SMS envoyé',
      // Si le SMS n'est pas envoyé (Twilio incomplet/non configuré), retourner l'OTP en clair
      ...(!smsWillBeSent ? { devOtp: otp } : {}),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — VERIFY 2FA (OTP SMS → accessToken admin)
  // ─────────────────────────────────────────────────────────────────────────────

  async verify2fa(dto: AdminVerify2faDto): Promise<{
    accessToken: string;
    admin: { id: string; email: string; firstName: string; lastName: string };
  }> {
    // Décoder et valider le tempToken
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.get<string>('jwt.adminSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token temporaire invalide ou expiré');
    }

    if (payload?.scope !== '2fa-pending' || !payload?.sub) {
      throw new UnauthorizedException('Token temporaire invalide');
    }

    const adminId = payload.sub as string;
    const redisKey = `otp:admin:${adminId}`;

    // Récupérer le hash OTP (Redis ou mémoire en dev)
    const storedHash = await this.otpGet(redisKey);
    if (!storedHash) {
      throw new UnauthorizedException('Code expiré — veuillez vous reconnecter');
    }

    // Comparer en temps constant pour éviter les timing attacks
    const submittedHash = this.encryptionService.hashToken(dto.code);
    const isValid = this.encryptionService.timingSafeEqual(submittedHash, storedHash);

    if (!isValid) {
      throw new UnauthorizedException('Code invalide');
    }

    // Supprimer l'OTP utilisé (Redis ou mémoire)
    await this.otpDel(redisKey);

    // Mettre à jour le dernier login et réinitialiser les échecs
    await this.adminRepo.update(adminId, {
      failedLoginCount: 0,
      lastLoginAt: new Date(),
      lockedUntil: null,
    });

    // Récupérer les infos admin
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Compte administrateur inactif');
    }

    // Générer le vrai access token (scope: platform-admin, durée: 8h)
    const accessToken = this.jwtService.sign(
      { sub: admin.id, scope: 'platform-admin', email: admin.email },
      {
        secret: this.configService.get<string>('jwt.adminSecret'),
        expiresIn: '24h',
      },
    );

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────────

  async logout(): Promise<{ message: string }> {
    // Les tokens JWT admin sont stateless — pas de blacklist côté serveur.
    // Le client doit supprimer le token localement.
    return { message: 'Déconnecté' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER PRIVÉ — Envoi SMS via Twilio
  // ─────────────────────────────────────────────────────────────────────────────

  private async sendOtpSms(phone: string, otp: string): Promise<void> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_FROM');

    if (!accountSid || !authToken || !fromNumber) {
      this.logger.warn(`[DEV MODE] Twilio non configuré — OTP = ${otp}`);
      return;
    }

    if (!phone) {
      this.logger.warn('Numéro SMS admin non configuré — OTP non envoyé');
      return;
    }

    try {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: `Code d'accès admin: ${otp}`,
        from: fromNumber,
        to: phone,
      });
    } catch (err) {
      this.logger.error('Erreur Twilio lors de l\'envoi du SMS', err);
      // On ne throw pas pour ne pas révéler des détails internes
      throw new UnauthorizedException('Impossible d\'envoyer le code SMS');
    }
  }
}

