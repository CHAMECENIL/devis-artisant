import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Extensions ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE plan_name AS ENUM ('bronze', 'silver', 'gold')`,
    );
    await queryRunner.query(
      `CREATE TYPE plan_billing_cycle AS ENUM ('monthly', 'annual')`,
    );
    await queryRunner.query(
      `CREATE TYPE tenant_status AS ENUM ('trial','active','suspended','cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE user_role AS ENUM ('owner','admin','user')`,
    );
    await queryRunner.query(
      `CREATE TYPE devis_status AS ENUM ('draft','sent','signed','accepted','rejected','archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE kanban_stage AS ENUM ('devis','signed','acompte','in_progress','done')`,
    );
    await queryRunner.query(
      `CREATE TYPE doc_type AS ENUM ('devis_pdf','facture','photo_chantier','plan','contrat_souscription','mandat_sepa','autre')`,
    );
    await queryRunner.query(
      `CREATE TYPE invoice_status AS ENUM ('draft','open','paid','void','uncollectible')`,
    );

    // ─── Tables ──────────────────────────────────────────────────────────────

    // subscription_plans
    await queryRunner.query(`
      CREATE TABLE subscription_plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name plan_name NOT NULL UNIQUE,
        label VARCHAR(50) NOT NULL,
        description TEXT,
        price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
        price_annual NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_users INTEGER NOT NULL DEFAULT 1,
        max_devis_per_month INTEGER NOT NULL DEFAULT 10,
        max_storage_gb NUMERIC(6,2) NOT NULL DEFAULT 1,
        ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ged_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        signature_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        multi_user_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        features JSONB DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // tenants
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug VARCHAR(63) NOT NULL UNIQUE,
        company_name VARCHAR(255) NOT NULL,
        company_siret VARCHAR(14),
        company_address TEXT,
        company_phone VARCHAR(20),
        company_logo_url TEXT,
        depot_address TEXT,
        margin_material NUMERIC(5,2) NOT NULL DEFAULT 30,
        hourly_rate NUMERIC(8,2) NOT NULL DEFAULT 15,
        km_rate NUMERIC(5,3) NOT NULL DEFAULT 0.300,
        tva_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
        anthropic_key_encrypted TEXT,
        google_maps_key_encrypted TEXT,
        smtp_host VARCHAR(255),
        smtp_port INTEGER DEFAULT 587,
        smtp_user VARCHAR(255),
        smtp_pass_encrypted TEXT,
        status tenant_status NOT NULL DEFAULT 'trial',
        trial_ends_at TIMESTAMPTZ,
        plan_id UUID REFERENCES subscription_plans(id),
        billing_cycle plan_billing_cycle DEFAULT 'monthly',
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        stripe_customer_id VARCHAR(100) UNIQUE,
        stripe_subscription_id VARCHAR(100),
        devis_count_this_month INTEGER NOT NULL DEFAULT 0,
        storage_used_bytes BIGINT NOT NULL DEFAULT 0,
        total_devis_generated INTEGER NOT NULL DEFAULT 0,
        total_tokens_consumed BIGINT NOT NULL DEFAULT 0,
        subscribed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        iban_encrypted TEXT,
        mandat_sepa_url TEXT,
        contrat_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMPTZ,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        role user_role NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        login_count INTEGER NOT NULL DEFAULT 0,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMPTZ,
        temp_password_hash VARCHAR(255),
        temp_password_expires TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      )
    `);

    // platform_admins
    await queryRunner.query(`
      CREATE TABLE platform_admins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        totp_secret_encrypted TEXT,
        sms_phone VARCHAR(20),
        last_login_at TIMESTAMPTZ,
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // refresh_tokens
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        family VARCHAR(255) NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // clients
    await queryRunner.query(`
      CREATE TABLE clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        siret VARCHAR(14),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // devis
    await queryRunner.query(`
      CREATE TABLE devis (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id),
        numero VARCHAR(30) NOT NULL,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        client_name VARCHAR(255),
        client_email VARCHAR(255),
        client_address TEXT,
        chantier_address TEXT,
        chantier_description TEXT,
        status devis_status NOT NULL DEFAULT 'draft',
        kanban_stage kanban_stage NOT NULL DEFAULT 'devis',
        total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_materials NUMERIC(12,2) DEFAULT 0,
        total_labor NUMERIC(12,2) DEFAULT 0,
        total_travel NUMERIC(12,2) DEFAULT 0,
        marge_brute NUMERIC(12,2) DEFAULT 0,
        taux_marge NUMERIC(6,2) DEFAULT 0,
        cout_reel NUMERIC(12,2) DEFAULT 0,
        rentabilite_horaire NUMERIC(8,2) DEFAULT 0,
        duree_jours INTEGER DEFAULT 1,
        distance_km NUMERIC(8,2) DEFAULT 0,
        remise_percent NUMERIC(5,2) DEFAULT 0,
        html_content TEXT,
        pdf_storage_key TEXT,
        notes TEXT,
        notes_internes TEXT,
        liste_achats JSONB,
        sent_at TIMESTAMPTZ,
        validity_days INTEGER NOT NULL DEFAULT 30,
        signature_token VARCHAR(255) UNIQUE,
        signature_expires_at TIMESTAMPTZ,
        signed_at TIMESTAMPTZ,
        signed_by VARCHAR(255),
        signed_ip INET,
        signature_provider VARCHAR(50),
        signature_provider_id VARCHAR(255),
        signature_audit_trail JSONB,
        acompte_amount NUMERIC(12,2) DEFAULT 0,
        acompte_received_at TIMESTAMPTZ,
        last_reminder_at TIMESTAMPTZ,
        reminder_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, numero)
      )
    `);

    // devis_lignes
    await queryRunner.query(`
      CREATE TABLE devis_lignes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        designation TEXT NOT NULL,
        unite VARCHAR(20) DEFAULT 'u',
        quantite NUMERIC(12,3) NOT NULL DEFAULT 1,
        prix_unitaire_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
        cout_materiau NUMERIC(12,2) DEFAULT 0,
        cout_main_oeuvre NUMERIC(12,2) DEFAULT 0,
        heures_mo NUMERIC(8,2) DEFAULT 0,
        notes TEXT,
        ordre INTEGER NOT NULL DEFAULT 0
      )
    `);

    // documents
    await queryRunner.query(`
      CREATE TABLE documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        uploaded_by UUID REFERENCES users(id),
        devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
        client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
        type doc_type NOT NULL DEFAULT 'autre',
        original_filename VARCHAR(500) NOT NULL,
        storage_key TEXT NOT NULL,
        storage_bucket VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        ai_analysis TEXT,
        metadata JSONB DEFAULT '{}',
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // conversations
    await queryRunner.query(`
      CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        session_id VARCHAR(255) NOT NULL,
        devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
        content TEXT NOT NULL,
        has_image BOOLEAN DEFAULT FALSE,
        document_id UUID REFERENCES documents(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // email_templates
    await queryRunner.query(`
      CREATE TABLE email_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        label VARCHAR(100),
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        delay_days INTEGER NOT NULL DEFAULT 3,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, type)
      )
    `);

    // reminders_log
    await queryRunner.query(`
      CREATE TABLE reminders_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        devis_id UUID REFERENCES devis(id) ON DELETE SET NULL,
        type VARCHAR(50),
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        recipient VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'sent',
        error_msg TEXT
      )
    `);

    // invoices
    await queryRunner.query(`
      CREATE TABLE invoices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        stripe_invoice_id VARCHAR(100) UNIQUE,
        stripe_payment_intent_id VARCHAR(100),
        numero VARCHAR(30) NOT NULL UNIQUE,
        status invoice_status NOT NULL DEFAULT 'draft',
        amount_ht NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_tva NUMERIC(10,2) NOT NULL DEFAULT 0,
        amount_ttc NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        description TEXT,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        payment_method VARCHAR(50),
        invoice_pdf_url TEXT,
        sepa_mandate_id VARCHAR(100),
        retry_count INTEGER DEFAULT 0,
        next_retry_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // audit_logs
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_type VARCHAR(20) NOT NULL,
        actor_id UUID NOT NULL,
        tenant_id UUID REFERENCES tenants(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        details JSONB DEFAULT '{}',
        ip_address INET,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Indexes ─────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX idx_tenants_slug ON tenants(slug)`);
    await queryRunner.query(`CREATE INDEX idx_tenants_status ON tenants(status)`);
    await queryRunner.query(`CREATE INDEX idx_users_tenant ON users(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant ON clients(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_devis_tenant ON devis(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_devis_status ON devis(tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_devis_kanban ON devis(tenant_id, kanban_stage)`);
    await queryRunner.query(`CREATE INDEX idx_devis_created ON devis(tenant_id, created_at DESC)`);
    await queryRunner.query(
      `CREATE INDEX idx_devis_sign_tok ON devis(signature_token) WHERE signature_token IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX idx_docs_tenant ON documents(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_invoices_tenant ON invoices(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_created ON audit_logs(created_at DESC)`);

    // ─── Row Level Security ───────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE clients ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE devis ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE conversations ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE reminders_log ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE invoices ENABLE ROW LEVEL SECURITY`);

    // ─── RLS Policies ────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE POLICY rls_clients ON clients USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_devis ON devis USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_devis_lignes ON devis_lignes USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_documents ON documents USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_conversations ON conversations USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_email_templates ON email_templates USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_reminders_log ON reminders_log USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
    await queryRunner.query(
      `CREATE POLICY rls_invoices ON invoices USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ─── Drop RLS Policies ───────────────────────────────────────────────────
    await queryRunner.query(`DROP POLICY IF EXISTS rls_invoices ON invoices`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_reminders_log ON reminders_log`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_email_templates ON email_templates`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_conversations ON conversations`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_documents ON documents`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_devis_lignes ON devis_lignes`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_devis ON devis`);
    await queryRunner.query(`DROP POLICY IF EXISTS rls_clients ON clients`);

    // ─── Drop Indexes ────────────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_docs_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_devis_sign_tok`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_devis_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_devis_kanban`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_devis_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_devis_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_family`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_refresh_tokens_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_email`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_slug`);

    // ─── Drop Tables (reverse dependency order) ───────────────────────────────
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoices`);
    await queryRunner.query(`DROP TABLE IF EXISTS reminders_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_templates`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS devis_lignes`);
    await queryRunner.query(`DROP TABLE IF EXISTS devis`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_admins`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscription_plans`);

    // ─── Drop Enums ───────────────────────────────────────────────────────────
    await queryRunner.query(`DROP TYPE IF EXISTS invoice_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS doc_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS kanban_stage`);
    await queryRunner.query(`DROP TYPE IF EXISTS devis_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenant_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS plan_billing_cycle`);
    await queryRunner.query(`DROP TYPE IF EXISTS plan_name`);

    // ─── Drop Extensions ─────────────────────────────────────────────────────
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
