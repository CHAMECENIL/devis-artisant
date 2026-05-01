import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { EncryptionService } from '../../common/utils/encryption.util';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(private encryptionService: EncryptionService) {}

  private getClient(tenant: any): Anthropic {
    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (tenant.anthropicKeyEncrypted) {
      try { apiKey = this.encryptionService.decrypt(tenant.anthropicKeyEncrypted); } catch {}
    }
    return new Anthropic({ apiKey });
  }

  async chat(dto: ChatDto, tenant: any): Promise<{ response: string; tokens: number }> {
    const client = this.getClient(tenant);
    const messages: Anthropic.MessageParam[] = [
      ...(dto.history ?? []).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: dto.message },
    ];

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: this.getBtpAssistantPrompt(tenant),
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return { response: text, tokens: response.usage.input_tokens + response.usage.output_tokens };
  }

  async challengeChiffrage(devisData: any, tenant: any): Promise<string> {
    const client = this.getClient(tenant);
    const prompt = `Analyse ce devis BTP et challenge le chiffrage. Identifie:
1. Les postes sous-estimés
2. Les difficultés techniques non anticipées
3. Les risques chantier (accès, démolition, mise aux normes)
4. Les fournitures oubliées
5. La durée réaliste des travaux

Devis: ${JSON.stringify(devisData, null, 2)}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: 'Tu es un expert BTP français qui challenge les devis pour éviter les mauvaises surprises.',
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  async estimerRentabilite(devisData: any, tenant: any): Promise<any> {
    const lignes = devisData.lignes ?? [];
    const mainOeuvre = lignes.filter((l: any) => l.type === 'main_oeuvre').reduce((s: number, l: any) => s + Number(l.montantHt), 0);
    const materiaux = lignes.filter((l: any) => l.type !== 'main_oeuvre').reduce((s: number, l: any) => s + Number(l.montantHt), 0);
    const prixAchats = lignes.reduce((s: number, l: any) => s + (Number(l.prixAchatHt ?? 0) * Number(l.quantite ?? 1)), 0);
    const totalHt = Number(devisData.montantHt ?? 0);
    const margeMateriaux = materiaux - prixAchats;
    const tauxMarge = totalHt > 0 ? ((margeMateriaux / totalHt) * 100) : 0;

    return {
      totalHt,
      mainOeuvre,
      materiaux,
      prixAchats,
      margeMateriaux: Math.round(margeMateriaux * 100) / 100,
      tauxMarge: Math.round(tauxMarge * 100) / 100,
      dureeJours: devisData.dureeJours ?? 0,
      tauxJournalier: devisData.dureeJours ? Math.round(mainOeuvre / devisData.dureeJours * 100) / 100 : 0,
    };
  }

  private getBtpAssistantPrompt(tenant: any): string {
    return `Tu es l'assistant IA d'un artisan BTP français. Tu aides à:
- Rédiger et améliorer des devis
- Estimer les coûts et durées de travaux
- Identifier les risques et difficultés
- Conseiller sur les matériaux et fournisseurs
- Répondre aux questions techniques BTP

Réponds toujours en français, de manière professionnelle et pratique.
Entreprise: ${tenant.companyName ?? 'Artisan BTP'}`;
  }
}
