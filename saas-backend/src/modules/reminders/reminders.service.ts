import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataSource } from 'typeorm';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private dataSource: DataSource,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processReminders() {
    this.logger.log('Processing devis reminders...');

    const pendingDevis = await this.dataSource.query(`
      SELECT d.id, d.numero, d.montant_ttc, d.client_name, d.client_email,
             d.created_at, d.sent_at, d.tenant_id
      FROM devis d
      JOIN tenants t ON t.id = d.tenant_id
      WHERE d.statut = 'envoye'
        AND d.client_email IS NOT NULL
        AND t.status = 'active'
        AND d.sent_at IS NOT NULL
    `);

    /** Jours de relance par défaut (configurable par tenant en v2) */
    const DEFAULT_REMINDER_DAYS = [7, 14, 30];

    for (const devis of pendingDevis) {
      const sentAt = new Date(devis.sent_at);
      const daysOld = Math.floor((Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysArr = DEFAULT_REMINDER_DAYS;

      if (daysArr.includes(daysOld)) {
        await this.emailQueue.add('reminder', {
          email: devis.client_email,
          clientName: devis.client_name,
          devisNumero: devis.numero,
          montantTtc: Number(devis.montant_ttc),
          daysOld,
        });
        this.logger.log(`Reminder queued for devis ${devis.numero} (day ${daysOld})`);
      }
    }
  }

  async sendManualReminder(devisId: string, tenantId: string) {
    const rows = await this.dataSource.query(`
      SELECT numero, montant_ttc, client_name, client_email, sent_at
      FROM devis WHERE id=? AND tenant_id=?
    `, [devisId, tenantId]);

    if (!rows[0] || !rows[0].client_email) throw new Error('Devis introuvable ou email client manquant');

    const daysOld = rows[0].sent_at
      ? Math.floor((Date.now() - new Date(rows[0].sent_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await this.emailQueue.add('reminder', {
      email: rows[0].client_email,
      clientName: rows[0].client_name,
      devisNumero: rows[0].numero,
      montantTtc: Number(rows[0].montant_ttc),
      daysOld,
    });

    return { success: true };
  }
}
