import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User } from './entities/user.entity';
import { EncryptionService } from '../../common/utils/encryption.util';

const BCRYPT_ROUNDS = 12;

/** Durée de validité du mot de passe temporaire d'invitation : 7 jours */
const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly encryptionService: EncryptionService,

    @InjectQueue('email')
    private readonly emailQueue: Queue,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // FIND
  // ─────────────────────────────────────────────────────────────────────────────

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email: email.toLowerCase(), tenantId },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }
    return user;
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'tenantId',
        'email',
        'firstName',
        'lastName',
        'phone',
        'role',
        'isActive',
        'emailVerified',
        'lastLoginAt',
        'loginCount',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────────

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.findById(id); // Lance NotFoundException si absent
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DEACTIVATE
  // ─────────────────────────────────────────────────────────────────────────────

  async deactivate(id: string): Promise<void> {
    await this.findById(id);
    await this.userRepo.update(id, { isActive: false });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVITE USER
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Crée un utilisateur invité avec un mot de passe temporaire aléatoire,
   * puis envoie un email d'invitation via la queue Bull.
   */
  async inviteUser(
    tenantId: string,
    email: string,
    role: string,
  ): Promise<void> {
    // Vérifier si l'email est déjà utilisé dans ce tenant
    const existing = await this.findByEmail(email, tenantId);
    if (existing) {
      throw new BadRequestException(
        'Un utilisateur avec cet email existe déjà dans votre organisation',
      );
    }

    // Générer un mot de passe temporaire lisible (16 hex chars)
    const tempPassword = this.encryptionService.generateToken(8); // 16 chars hex
    const tempPasswordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    const tempPasswordExpires = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

    // Créer le compte avec emailVerified=true (l'invitation vaut vérification)
    const user = await this.create({
      id: uuidv4(),
      tenantId,
      email: email.toLowerCase(),
      passwordHash: tempPasswordHash,
      tempPasswordHash,
      tempPasswordExpires,
      role,
      emailVerified: true,
      isActive: true,
      loginCount: 0,
    });

    // Envoyer l'email d'invitation
    await this.emailQueue.add('send-invitation-email', {
      to: user.email,
      tempPassword,
      role,
    });

    this.logger.log(`Utilisateur invité : ${user.email} (tenant: ${tenantId}, rôle: ${role})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);

    // Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new ForbiddenException('Mot de passe actuel incorrect');
    }

    // S'assurer que le nouveau mot de passe est différent
    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent de l\'actuel',
      );
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.userRepo.update(userId, {
      passwordHash: newHash,
      tempPasswordHash: null,
      tempPasswordExpires: null,
    });
  }
}
