import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { EncryptionService } from '../../common/utils/encryption.util';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import * as nodemailer from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    private readonly encryption: EncryptionService,
  ) {}

  async getSettings(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant introuvable');

    // Masquer les valeurs chiffrées — retourner uniquement des booléens de présence
    return {
      id: tenant.id,
      companyName: tenant.companyName,
      companySiret: tenant.companySiret,
      companyAddress: tenant.companyAddress,
      companyPhone: tenant.companyPhone,
      companyLogoUrl: tenant.companyLogoUrl,
      depotAddress: tenant.depotAddress,
      tvaRate: tenant.tvaRate,
      hourlyRate: tenant.hourlyRate,
      kmRate: tenant.kmRate,
      marginMaterial: tenant.marginMaterial,
      smtpHost: tenant.smtpHost,
      smtpPort: tenant.smtpPort,
      smtpUser: tenant.smtpUser,
      smtpConfigured: !!(tenant.smtpHost && tenant.smtpPassEncrypted),
      anthropicKeyConfigured: !!tenant.anthropicKeyEncrypted,
      googleMapsKeyConfigured: !!tenant.googleMapsKeyEncrypted,
      status: tenant.status,
      planId: tenant.planId,
      storageUsedBytes: tenant.storageUsedBytes,
      totalDevisGenerated: tenant.totalDevisGenerated,
      createdAt: tenant.createdAt,
    };
  }

  async updateSettings(tenantId: string, dto: UpdateSettingsDto): Promise<{ message: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant introuvable');

    const update: Partial<Tenant> = {};

    if (dto.companyName !== undefined) update.companyName = dto.companyName;
    if (dto.companyAddress !== undefined) update.companyAddress = dto.companyAddress;
    if (dto.companyPhone !== undefined) update.companyPhone = dto.companyPhone;
    if (dto.companySiret !== undefined) update.companySiret = dto.companySiret;
    if (dto.depotAddress !== undefined) update.depotAddress = dto.depotAddress;
    if (dto.companyLogoUrl !== undefined) update.companyLogoUrl = dto.companyLogoUrl;
    if (dto.tvaRate !== undefined) update.tvaRate = dto.tvaRate;
    if (dto.hourlyRate !== undefined) update.hourlyRate = dto.hourlyRate;
    if (dto.kmRate !== undefined) update.kmRate = dto.kmRate;
    if (dto.marginMaterial !== undefined) update.marginMaterial = dto.marginMaterial;
    if (dto.smtpHost !== undefined) update.smtpHost = dto.smtpHost;
    if (dto.smtpPort !== undefined) update.smtpPort = dto.smtpPort;
    if (dto.smtpUser !== undefined) update.smtpUser = dto.smtpUser;

    // Chiffrement des valeurs sensibles
    if (dto.smtpPass) update.smtpPassEncrypted = this.encryption.encrypt(dto.smtpPass);
    if (dto.anthropicKey) update.anthropicKeyEncrypted = this.encryption.encrypt(dto.anthropicKey);
    if (dto.googleMapsKey) update.googleMapsKeyEncrypted = this.encryption.encrypt(dto.googleMapsKey);

    await this.tenantRepo.update(tenantId, update);
    return { message: 'Paramètres mis à jour avec succès' };
  }

  async testAI(tenantId: string): Promise<{ success: boolean; message: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant?.anthropicKeyEncrypted) {
      return { success: false, message: 'Aucune clé Anthropic configurée' };
    }

    try {
      const apiKey = this.encryption.decrypt(tenant.anthropicKeyEncrypted);
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Test' }],
      });
      return { success: true, message: 'Connexion IA opérationnelle ✓' };
    } catch (e) {
      return { success: false, message: `Erreur: ${e.message}` };
    }
  }

  async testSmtp(tenantId: string): Promise<{ success: boolean; message?: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant?.smtpHost) {
      return { success: false, message: 'Configuration SMTP incomplète' };
    }

    try {
      const pass = tenant.smtpPassEncrypted
        ? this.encryption.decrypt(tenant.smtpPassEncrypted)
        : undefined;

      const transporter = nodemailer.createTransport({
        host: tenant.smtpHost,
        port: tenant.smtpPort || 587,
        secure: (tenant.smtpPort || 587) === 465,
        auth: tenant.smtpUser ? { user: tenant.smtpUser, pass } : undefined,
      });

      await transporter.verify();
      return { success: true, message: 'Connexion SMTP opérationnelle ✓' };
    } catch (e) {
      return { success: false, message: `Erreur SMTP: ${e.message}` };
    }
  }

  async testMaps(tenantId: string, origin: string, destination: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant?.googleMapsKeyEncrypted) {
      return { success: false, message: 'Aucune clé Google Maps configurée' };
    }
    const apiKey = this.encryption.decrypt(tenant.googleMapsKeyEncrypted);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}&language=fr&units=metric`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return { success: false, message: data.status };

    const element = data.rows?.[0]?.elements?.[0];
    return {
      success: true,
      distance: element?.distance?.text,
      duration: element?.duration?.text,
      distanceValue: element?.distance?.value,
    };
  }
}
