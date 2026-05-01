import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { DataSource } from 'typeorm';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private dataSource: DataSource) {}

  private async getTransporter(tenantId?: string) {
    let config = {
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '' },
    };

    if (tenantId) {
      const rows = await this.dataSource.query(
        'SELECT smtp_host, smtp_port, smtp_user, smtp_pass_encrypted FROM tenants WHERE id=$1', [tenantId]
      );
      if (rows[0]?.smtp_host) {
        config = { host: rows[0].smtp_host, port: rows[0].smtp_port, secure: false, auth: { user: rows[0].smtp_user, pass: rows[0].smtp_pass_encrypted } };
      }
    }

    return nodemailer.createTransport(config);
  }

  @Process('verification')
  async sendVerification(job: Job<{ email: string; name: string; token: string; tenantId: string }>) {
    const { email, name, token, tenantId } = job.data;
    const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const transporter = await this.getTransporter();

    await transporter.sendMail({
      to: email,
      subject: 'Vérifiez votre adresse email',
      html: this.verificationTemplate(name, url),
    });
    this.logger.log(`Verification email sent to ${email}`);
  }

  @Process('reset-password')
  async sendResetPassword(job: Job<{ email: string; name: string; token: string }>) {
    const { email, name, token } = job.data;
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const transporter = await this.getTransporter();

    await transporter.sendMail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: this.resetPasswordTemplate(name, url),
    });
  }

  @Process('devis-sent')
  async sendDevis(job: Job<{ devisId: string; email: string; message?: string; devisNumero: string }>) {
    const { email, message, devisNumero } = job.data;
    const transporter = await this.getTransporter();

    await transporter.sendMail({
      to: email,
      subject: `Devis ${devisNumero}`,
      html: this.devisSentTemplate(devisNumero, message),
    });
    this.logger.log(`Devis ${devisNumero} sent to ${email}`);
  }

  @Process('reminder')
  async sendReminder(job: Job<{ email: string; clientName: string; devisNumero: string; montantTtc: number; daysOld: number }>) {
    const { email, clientName, devisNumero, montantTtc, daysOld } = job.data;
    const transporter = await this.getTransporter();

    await transporter.sendMail({
      to: email,
      subject: `Rappel — Devis ${devisNumero} en attente de validation`,
      html: this.reminderTemplate(clientName, devisNumero, montantTtc, daysOld),
    });
  }

  private verificationTemplate(name: string, url: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#2563eb;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">Bienvenue !</h1>
      </div>
      <div style="padding:30px;background:#f8fafc">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Merci pour votre inscription. Cliquez ci-dessous pour activer votre compte :</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${url}" style="background:#2563eb;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">
            Vérifier mon email
          </a>
        </div>
        <p style="color:#666;font-size:12px">Ce lien expire dans 24h. Si vous n'avez pas créé de compte, ignorez cet email.</p>
      </div>
    </div>`;
  }

  private resetPasswordTemplate(name: string, url: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#dc2626;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">Réinitialisation mot de passe</h1>
      </div>
      <div style="padding:30px;background:#f8fafc">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe :</p>
        <div style="text-align:center;margin:30px 0">
          <a href="${url}" style="background:#dc2626;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color:#666;font-size:12px">Ce lien expire dans 1h. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      </div>
    </div>`;
  }

  private devisSentTemplate(devisNumero: string, message?: string): string {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#2563eb;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">Votre devis est disponible</h1>
      </div>
      <div style="padding:30px;background:#f8fafc">
        <p>Votre devis <strong>${devisNumero}</strong> vous a été transmis.</p>
        ${message ? `<div style="background:white;padding:15px;border-radius:6px;border-left:4px solid #2563eb;margin:15px 0">${message}</div>` : ''}
        <p>Merci de nous contacter pour toute question.</p>
      </div>
    </div>`;
  }

  private reminderTemplate(clientName: string, devisNumero: string, montantTtc: number, daysOld: number): string {
    const montant = montantTtc.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <div style="background:#f59e0b;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">Rappel — Devis en attente</h1>
      </div>
      <div style="padding:30px;background:#f8fafc">
        <p>Bonjour <strong>${clientName}</strong>,</p>
        <p>Notre devis <strong>${devisNumero}</strong> d'un montant de <strong>${montant}</strong> est en attente de votre validation depuis ${daysOld} jour(s).</p>
        <p>N'hésitez pas à nous contacter pour toute question ou ajustement.</p>
        <p style="color:#666;font-size:12px">Si vous avez déjà traité ce devis, veuillez ignorer ce rappel.</p>
      </div>
    </div>`;
  }
}
