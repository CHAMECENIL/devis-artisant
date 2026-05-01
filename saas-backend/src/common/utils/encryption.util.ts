import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = this.config.get<string>('MASTER_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes / AES-256)',
      );
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  /**
   * Chiffre un texte en clair avec AES-256-GCM.
   * @returns Chaîne au format `iv:encrypted:tag` (hex)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV recommandé pour GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 128-bit auth tag
    return [iv, encrypted, tag].map((b) => b.toString('hex')).join(':');
  }

  /**
   * Déchiffre une chaîne au format `iv:encrypted:tag` (hex).
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Format de ciphertext invalide — attendu iv:encrypted:tag');
    }
    const [ivHex, encHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Hache un token avec SHA-256 (pour tokens de refresh, OTP, etc.).
   * @returns Hex digest 64 caractères
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Génère un token aléatoire cryptographiquement sûr.
   * @param bytes Nombre d'octets aléatoires (défaut 32 → 64 hex chars)
   */
  generateToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Compare deux chaînes en temps constant pour éviter les timing attacks.
   */
  timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
