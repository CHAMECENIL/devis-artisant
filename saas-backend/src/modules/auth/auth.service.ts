import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { EncryptionService } from '../../common/utils/encryption.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

/**
 * Slugifie une chaîne : minuscules, accents supprimés, caractères non-alphanumériques remplacés par des tirets.
 */
function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly dataSource: DataSource,

    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────────

  async register(
    dto: RegisterDto,
    ip?: string,
  ): Promise<{ message: string }> {
    // Vérifier unicité email (global — un email = un seul compte owner)
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Un compte avec cet email existe déjà');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Générer un slug unique pour le tenant
    const baseSlug = slugify(dto.companyName);
    const uniqueSlug = `${baseSlug}-${uuidv4().replace(/-/g, '').slice(0, 8)}`;

    // Calculer trial_ends_at (14 jours)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Utiliser une transaction pour créer tenant + user + templates
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let tenantId: string;
    let userId: string;

    try {
      // INSERT tenant
      const tenantResult = await queryRunner.query(
        `INSERT INTO tenants (id, name, slug, status, trial_ends_at, phone, created_at, updated_at)
         VALUES ($1, $2, $3, 'trial', $4, $5, NOW(), NOW())
         RETURNING id`,
        [uuidv4(), dto.companyName, uniqueSlug, trialEndsAt, dto.companyPhone ?? null],
      );
      tenantId = tenantResult[0].id;

      // INSERT user (owner)
      const userResult = await queryRunner.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role,
                            email_verified, is_active, login_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'owner', false, true, 0, NOW(), NOW())
         RETURNING id`,
        [
          uuidv4(),
          tenantId,
          dto.email.toLowerCase(),
          passwordHash,
          dto.firstName,
          dto.lastName,
        ],
      );
      userId = userResult[0].id;

      // Créer les 5 templates email par défaut
      const defaultTemplates = [
        {
          name: 'devis_relance',
          subject: 'Relance — votre devis est en attente',
          body: 'Bonjour,\n\nNous vous relançons concernant le devis que nous vous avons envoyé.\n\nCordialement,\n{{company_name}}',
        },
        {
          name: 'signature_relance',
          subject: 'Rappel — signature de devis en attente',
          body: 'Bonjour,\n\nNous vous rappelons que votre devis est en attente de signature.\n\nCordialement,\n{{company_name}}',
        },
        {
          name: 'acompte_relance',
          subject: 'Relance acompte — règlement attendu',
          body: 'Bonjour,\n\nNous vous relançons concernant le règlement de l\'acompte.\n\nCordialement,\n{{company_name}}',
        },
        {
          name: 'paiement_relance',
          subject: 'Relance paiement — facture en attente',
          body: 'Bonjour,\n\nNous vous relançons concernant le paiement de votre facture.\n\nCordialement,\n{{company_name}}',
        },
        {
          name: 'welcome',
          subject: 'Bienvenue chez {{company_name}}',
          body: 'Bonjour {{client_name}},\n\nBienvenue ! Nous sommes heureux de vous compter parmi nos clients.\n\nCordialement,\n{{company_name}}',
        },
      ];

      for (const tpl of defaultTemplates) {
        await queryRunner.query(
          `INSERT INTO email_templates (id, tenant_id, name, subject, body, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [uuidv4(), tenantId, tpl.name, tpl.subject, tpl.body],
        );
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Erreur lors de la création du compte', err);
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Générer le token de vérification email
    const rawToken = this.encryptionService.generateToken(32);
    const tokenHash = this.encryptionService.hashToken(rawToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await this.userRepo.update(
      { id: userId },
      {
        emailVerificationToken: tokenHash,
        emailVerificationExpires: verificationExpires,
      },
    );

    // Envoyer l'email de vérification via Bull Queue
    await this.emailQueue.add('send-verification-email', {
      to: dto.email,
      firstName: dto.firstName,
      verificationToken: rawToken,
      companyName: dto.companyName,
    });

    return { message: 'Vérifiez votre email pour activer votre compte' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VERIFY EMAIL
  // ─────────────────────────────────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    tenant: any;
  }> {
    const tokenHash = this.encryptionService.hashToken(token);

    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('u.email_verification_token = :tokenHash', { tokenHash })
      .andWhere('u.email_verification_expires > NOW()')
      .getOne();

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    // Marquer l'email comme vérifié
    await this.userRepo.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    // Activer le tenant si trial toujours valide
    await this.dataSource.query(
      `UPDATE tenants
       SET status = 'active', updated_at = NOW()
       WHERE id = $1
         AND trial_ends_at > NOW()
         AND status = 'trial'`,
      [user.tenantId],
    );

    const tenant = await this.getTenantById(user.tenantId);
    user.emailVerified = true;

    const tokens = await this.generateTokenPair(user, tenant);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenant,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    tenant: any;
  }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const tenant = await this.getTenantById(user.tenantId);

    if (!tenant || !['active', 'trial'].includes(tenant.status)) {
      throw new ForbiddenException('Compte suspendu');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email non vérifié');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Mettre à jour les métadonnées de connexion
    await this.userRepo.update(user.id, {
      lastLoginAt: new Date(),
      loginCount: () => 'login_count + 1',
    } as any);

    user.lastLoginAt = new Date();
    user.loginCount += 1;

    const tokens = await this.generateTokenPair(user, tenant, ip, userAgent);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      tenant,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REFRESH TOKENS
  // ─────────────────────────────────────────────────────────────────────────────

  async refreshTokens(
    oldRefreshToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.encryptionService.hashToken(oldRefreshToken);

    const storedToken = await this.refreshTokenRepo.findOne({
      where: { tokenHash, isRevoked: false },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expiré');
    }

    // Détection de replay : vérifier si d'autres tokens actifs existent dans la même famille
    const activeSiblings = await this.refreshTokenRepo
      .createQueryBuilder('rt')
      .where('rt.family = :family', { family: storedToken.family })
      .andWhere('rt.id != :id', { id: storedToken.id })
      .andWhere('rt.is_revoked = false')
      .getCount();

    if (activeSiblings > 0) {
      // Révoquer toute la famille (session compromise)
      await this.refreshTokenRepo
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ isRevoked: true })
        .where('family = :family', { family: storedToken.family })
        .execute();

      throw new UnauthorizedException('Session compromise — veuillez vous reconnecter');
    }

    // Révoquer l'ancien token
    await this.refreshTokenRepo.update(storedToken.id, { isRevoked: true });

    // Récupérer l'utilisateur
    const user = await this.userRepo.findOne({ where: { id: storedToken.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur inactif');
    }

    const tenant = await this.getTenantById(user.tenantId);

    // Générer une nouvelle paire, en réutilisant la même family pour la rotation
    const rawToken = this.encryptionService.generateToken(32);
    const newTokenHash = this.encryptionService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash: newTokenHash,
        family: storedToken.family,
        isRevoked: false,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      }),
    );

    const accessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn', '15m'),
    });

    return { accessToken, refreshToken: rawToken };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<{ message: string }> {
    const tokenHash = this.encryptionService.hashToken(refreshToken);
    await this.refreshTokenRepo.update({ tokenHash }, { isRevoked: true });
    return { message: 'Déconnecté avec succès' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const message = 'Si cet email existe, un lien de réinitialisation a été envoyé';

    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Pas d'énumération — on retourne quand même le même message
      return { message };
    }

    const rawToken = this.encryptionService.generateToken(32);
    const tokenHash = this.encryptionService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h

    await this.userRepo.update(user.id, {
      passwordResetToken: tokenHash,
      passwordResetExpires: expiresAt,
    });

    await this.emailQueue.add('send-password-reset-email', {
      to: user.email,
      firstName: user.firstName,
      resetToken: rawToken,
    });

    return { message };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.encryptionService.hashToken(token);

    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('u.password_reset_token = :tokenHash', { tokenHash })
      .andWhere('u.password_reset_expires > NOW()')
      .getOne();

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.userRepo.update(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    // Révoquer tous les refresh tokens de cet utilisateur
    await this.refreshTokenRepo.update(
      { userId: user.id },
      { isRevoked: true },
    );

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESEND VERIFICATION EMAIL
  // ─────────────────────────────────────────────────────────────────────────────

  async resendVerification(email: string): Promise<{ message: string }> {
    const message = 'Si cet email est enregistré et non vérifié, un nouvel email a été envoyé';

    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.emailVerified) {
      return { message };
    }

    const rawToken = this.encryptionService.generateToken(32);
    const tokenHash = this.encryptionService.hashToken(rawToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.userRepo.update(user.id, {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: verificationExpires,
    });

    await this.emailQueue.add('send-verification-email', {
      to: user.email,
      firstName: user.firstName,
      verificationToken: rawToken,
    });

    return { message };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE TOKEN PAIR (ACCESS + REFRESH)
  // ─────────────────────────────────────────────────────────────────────────────

  async generateTokenPair(
    user: User,
    tenant: any,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn', '15m'),
    });

    // Refresh token : générer un token aléatoire et stocker son hash
    const rawToken = this.encryptionService.generateToken(32);
    const tokenHash = this.encryptionService.hashToken(rawToken);
    const family = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7j

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash,
        family,
        isRevoked: false,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      }),
    );

    return { accessToken, refreshToken: rawToken };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVÉS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getTenantById(tenantId: string): Promise<any> {
    const results = await this.dataSource.query(
      'SELECT * FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId],
    );
    return results[0] ?? null;
  }

  private sanitizeUser(user: User): Partial<User> {
    const {
      passwordHash,
      emailVerificationToken,
      emailVerificationExpires,
      passwordResetToken,
      passwordResetExpires,
      tempPasswordHash,
      tempPasswordExpires,
      ...safe
    } = user;
    return safe;
  }
}
