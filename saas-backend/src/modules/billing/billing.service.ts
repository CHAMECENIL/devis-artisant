import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    private dataSource: DataSource,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2023-10-16' });
  }

  async createCheckoutSession(tenantId: string, planId: string, successUrl: string, cancelUrl: string): Promise<string> {
    const plans = await this.dataSource.query('SELECT * FROM subscription_plans WHERE id=$1', [planId]);
    if (!plans[0]) throw new BadRequestException('Plan introuvable');

    const tenants = await this.dataSource.query('SELECT * FROM tenants WHERE id=$1', [tenantId]);
    if (!tenants[0]) throw new BadRequestException('Tenant introuvable');

    const tenant = tenants[0];
    const plan = plans[0];

    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: tenant.email,
        name: tenant.company_name,
        metadata: { tenantId },
      });
      customerId = customer.id;
      await this.dataSource.query('UPDATE tenants SET stripe_customer_id=$1 WHERE id=$2', [customerId, tenantId]);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId, planId },
      locale: 'fr',
    });

    return session.url ?? '';
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '');
    } catch (e) {
      throw new BadRequestException(`Webhook signature invalide: ${e.message}`);
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { tenantId, planId } = session.metadata ?? {};
    if (!tenantId || !planId) return;

    await this.dataSource.query(`
      UPDATE tenants SET
        plan_id=$1,
        stripe_subscription_id=$2,
        status='active',
        subscription_status='active'
      WHERE id=$3
    `, [planId, session.subscription, tenantId]);

    this.logger.log(`Tenant ${tenantId} subscribed to plan ${planId}`);
  }

  private async handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
    const tenants = await this.dataSource.query(
      'SELECT id FROM tenants WHERE stripe_customer_id=$1', [stripeInvoice.customer]
    );
    if (!tenants[0]) return;
    const tenantId = tenants[0].id;

    const invoice = this.invoiceRepo.create({
      tenantId,
      stripeInvoiceId: stripeInvoice.id,
      stripeSubscriptionId: stripeInvoice.subscription as string,
      amountCents: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency,
      status: InvoiceStatus.PAID,
      paidAt: new Date(stripeInvoice.status_transitions?.paid_at ? stripeInvoice.status_transitions.paid_at * 1000 : Date.now()),
      invoicePdfUrl: stripeInvoice.invoice_pdf ?? undefined,
    });
    await this.invoiceRepo.save(invoice);

    await this.dataSource.query(
      'UPDATE tenants SET subscription_status=$1 WHERE stripe_customer_id=$2',
      ['active', stripeInvoice.customer]
    );
  }

  private async handlePaymentFailed(stripeInvoice: Stripe.Invoice) {
    await this.dataSource.query(
      'UPDATE tenants SET subscription_status=$1 WHERE stripe_customer_id=$2',
      ['past_due', stripeInvoice.customer]
    );
    this.logger.warn(`Payment failed for customer ${stripeInvoice.customer}`);
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    await this.dataSource.query(
      'UPDATE tenants SET subscription_status=$1, status=$2 WHERE stripe_subscription_id=$3',
      ['canceled', 'suspended', subscription.id]
    );
    this.logger.log(`Subscription canceled: ${subscription.id}`);
  }

  async getInvoices(tenantId: string) {
    return this.invoiceRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async getPortalUrl(tenantId: string, returnUrl: string): Promise<string> {
    const tenants = await this.dataSource.query('SELECT stripe_customer_id FROM tenants WHERE id=$1', [tenantId]);
    if (!tenants[0]?.stripe_customer_id) throw new BadRequestException('Aucun abonnement actif');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenants[0].stripe_customer_id,
      return_url: returnUrl,
    });
    return session.url;
  }
}
