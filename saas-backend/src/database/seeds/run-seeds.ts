import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables before importing DataSource
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import AppDataSource from '../datasource';

interface PlanSeed {
  name: 'bronze' | 'silver' | 'gold';
  label: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  max_users: number;
  max_devis_per_month: number;
  max_storage_gb: number;
  ai_enabled: boolean;
  ged_enabled: boolean;
  signature_enabled: boolean;
  multi_user_enabled: boolean;
  features: Record<string, unknown>;
}

const PLANS: PlanSeed[] = [
  {
    name: 'bronze',
    label: 'Bronze',
    description:
      'Idéal pour les artisans indépendants qui démarrent. Gestion simple des devis avec IA basique.',
    price_monthly: 29,
    price_annual: 290,
    max_users: 1,
    max_devis_per_month: 20,
    max_storage_gb: 2,
    ai_enabled: true,
    ged_enabled: false,
    signature_enabled: false,
    multi_user_enabled: false,
    features: {
      devis_pdf: true,
      client_management: true,
      kanban: true,
      reminders: true,
      ai_generation: true,
      ai_photo_analysis: false,
      ged: false,
      esignature: false,
      multi_user: false,
      custom_smtp: false,
      api_access: false,
    },
  },
  {
    name: 'silver',
    label: 'Silver',
    description:
      'Pour les artisans en croissance. GED complète, analyse de photos IA, relances automatiques.',
    price_monthly: 59,
    price_annual: 590,
    max_users: 3,
    max_devis_per_month: 100,
    max_storage_gb: 10,
    ai_enabled: true,
    ged_enabled: true,
    signature_enabled: false,
    multi_user_enabled: true,
    features: {
      devis_pdf: true,
      client_management: true,
      kanban: true,
      reminders: true,
      ai_generation: true,
      ai_photo_analysis: true,
      ged: true,
      esignature: false,
      multi_user: true,
      custom_smtp: true,
      api_access: false,
    },
  },
  {
    name: 'gold',
    label: 'Gold',
    description:
      'La solution complète pour les entreprises artisanales. Signature électronique, multi-utilisateurs illimités, API.',
    price_monthly: 99,
    price_annual: 990,
    max_users: 10,
    max_devis_per_month: -1, // illimité
    max_storage_gb: 50,
    ai_enabled: true,
    ged_enabled: true,
    signature_enabled: true,
    multi_user_enabled: true,
    features: {
      devis_pdf: true,
      client_management: true,
      kanban: true,
      reminders: true,
      ai_generation: true,
      ai_photo_analysis: true,
      ged: true,
      esignature: true,
      multi_user: true,
      custom_smtp: true,
      api_access: true,
      priority_support: true,
      white_label: false,
    },
  },
];

async function runSeeds(): Promise<void> {
  console.log('Initializing database connection...');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  console.log('Database connected. Running seeds...');

  try {
    for (const plan of PLANS) {
      // Check if plan already exists
      const existing = await AppDataSource.query(
        `SELECT id FROM subscription_plans WHERE name = $1`,
        [plan.name],
      );

      if (existing.length > 0) {
        console.log(`[SKIP] Plan "${plan.label}" already exists (id: ${existing[0].id})`);
        continue;
      }

      // Insert plan
      const result = await AppDataSource.query(
        `INSERT INTO subscription_plans (
          name, label, description,
          price_monthly, price_annual,
          max_users, max_devis_per_month, max_storage_gb,
          ai_enabled, ged_enabled, signature_enabled, multi_user_enabled,
          features, is_active
        ) VALUES (
          $1, $2, $3,
          $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13::jsonb, TRUE
        ) RETURNING id`,
        [
          plan.name,
          plan.label,
          plan.description,
          plan.price_monthly,
          plan.price_annual,
          plan.max_users,
          plan.max_devis_per_month,
          plan.max_storage_gb,
          plan.ai_enabled,
          plan.ged_enabled,
          plan.signature_enabled,
          plan.multi_user_enabled,
          JSON.stringify(plan.features),
        ],
      );

      console.log(`[OK] Plan "${plan.label}" inserted with id: ${result[0].id}`);
    }

    // Summary
    const allPlans = await AppDataSource.query(
      `SELECT id, name, label, price_monthly, price_annual FROM subscription_plans ORDER BY price_monthly ASC`,
    );

    console.log('\n=== Subscription Plans in Database ===');
    console.table(allPlans);
    console.log('Seeds completed successfully.');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
    console.log('Database connection closed.');
  }
}

runSeeds().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
