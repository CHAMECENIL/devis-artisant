import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../../common/utils/encryption.util';
import axios from 'axios';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private dataSource: DataSource,
    private encryptionService: EncryptionService,
  ) {}

  async initiateSignature(devisId: string, signerEmail: string, signerName: string, tenant: any): Promise<any> {
    const rows = await this.dataSource.query(
      'SELECT * FROM devis WHERE id=$1 AND tenant_id=$2', [devisId, tenant.id]
    );
    if (!rows[0]) throw new BadRequestException('Devis introuvable');
    const devis = rows[0];

    // Internal signature token (fallback when no YouSign)
    const token = this.encryptionService.generateToken(32);
    const hashedToken = this.encryptionService.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.dataSource.query(`
      UPDATE devis SET
        signature_status='pending',
        signature_request_id=$1,
        signature_token_hash=$2,
        signature_expires_at=$3
      WHERE id=$4
    `, [hashedToken, hashedToken, expiresAt, devisId]);

    let signatureUrl = `${process.env.FRONTEND_URL}/signature/${devisId}?token=${token}`;
    let provider = 'internal';

    // Try YouSign if configured
    if (tenant.yousignApiKey) {
      try {
        const yousignResult = await this.createYousignRequest(devis, signerEmail, signerName, tenant);
        signatureUrl = yousignResult.url;
        provider = 'yousign';
        await this.dataSource.query(
          'UPDATE devis SET signature_request_id=$1 WHERE id=$2',
          [yousignResult.id, devisId]
        );
      } catch (e) {
        this.logger.warn(`YouSign failed, falling back to internal: ${e.message}`);
      }
    }

    this.logger.log(`Signature initiated for devis ${devisId} via ${provider}`);
    return { signatureUrl, provider, expiresAt };
  }

  async verifySignature(devisId: string, token: string, tenantId: string): Promise<any> {
    const rows = await this.dataSource.query(
      'SELECT * FROM devis WHERE id=$1 AND tenant_id=$2', [devisId, tenantId]
    );
    if (!rows[0]) throw new BadRequestException('Devis introuvable');
    const devis = rows[0];

    const hashedToken = this.encryptionService.hashToken(token);
    const isValid = this.encryptionService.timingSafeEqual(hashedToken, devis.signature_token_hash ?? '');
    if (!isValid) throw new BadRequestException('Token de signature invalide');

    if (devis.signature_expires_at && new Date(devis.signature_expires_at) < new Date()) {
      throw new BadRequestException('Le lien de signature a expiré');
    }

    await this.dataSource.query(`
      UPDATE devis SET signature_status='signed', statut='accepte', accepted_at=NOW()
      WHERE id=$1
    `, [devisId]);

    return { success: true, devisNumero: devis.numero };
  }

  async getSignatureStatus(devisId: string, tenantId: string): Promise<any> {
    const rows = await this.dataSource.query(
      'SELECT signature_status, signature_request_id, accepted_at FROM devis WHERE id=$1 AND tenant_id=$2',
      [devisId, tenantId]
    );
    if (!rows[0]) throw new BadRequestException('Devis introuvable');
    return rows[0];
  }

  private async createYousignRequest(devis: any, signerEmail: string, signerName: string, tenant: any) {
    let apiKey: string;
    try { apiKey = this.encryptionService.decrypt(tenant.yousignApiKey); } catch { apiKey = tenant.yousignApiKey; }

    const baseUrl = process.env.YOUSIGN_ENV === 'production'
      ? 'https://api.yousign.app/v3'
      : 'https://api-sandbox.yousign.app/v3';

    const response = await axios.post(`${baseUrl}/signature_requests`, {
      name: `Devis ${devis.numero}`,
      delivery_mode: 'email',
      signers: [{
        info: { first_name: signerName.split(' ')[0], last_name: signerName.split(' ').slice(1).join(' ') || signerName, email: signerEmail },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'no_otp',
      }],
      external_id: devis.id,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });

    return { id: response.data.id, url: response.data.signers?.[0]?.signature_link };
  }
}
