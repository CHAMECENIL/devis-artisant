import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// Config
import { databaseConfig } from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';

// Common
import { CommonModule } from './common/common.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DevisModule } from './modules/devis/devis.module';
import { AiModule } from './modules/ai/ai.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { KanbanModule } from './modules/kanban/kanban.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmailModule } from './modules/email/email.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { StorageModule } from './modules/storage/storage.module';
import { GedModule } from './modules/ged/ged.module';
import { SignatureModule } from './modules/signature/signature.module';
import { BillingModule } from './modules/billing/billing.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, storageConfig],
      envFilePath: ['.env', 'saas-backend/.env'],
    }),

    // ── Logging ────────────────────────────────────────────────────────────────
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) =>
              `${timestamp} [${context ?? 'App'}] ${level}: ${message}`
            ),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      ],
    }),

    // ── Database ───────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),

    // ── Rate limiting ──────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),

    // ── Queues ─────────────────────────────────────────────────────────────────
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        // Back off slowly when Redis is unavailable (e.g. local dev without Redis)
        retryStrategy: (times: number) =>
          process.env.NODE_ENV === 'production'
            ? Math.min(times * 500, 10_000)
            : Math.min(times * 2_000, 60_000), // max 60 s in dev
      },
    }),

    // ── Scheduler ──────────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Common ─────────────────────────────────────────────────────────────────
    CommonModule,

    // ── Infrastructure ─────────────────────────────────────────────────────────
    StorageModule,
    EmailModule,

    // ── Auth ───────────────────────────────────────────────────────────────────
    AuthModule,
    AdminAuthModule,

    // ── User & Tenant management ───────────────────────────────────────────────
    UsersModule,
    TenantsModule,

    // ── Business modules ───────────────────────────────────────────────────────
    ClientsModule,
    DevisModule,
    AiModule,
    PdfModule,
    KanbanModule,
    DashboardModule,
    RemindersModule,
    GedModule,
    SignatureModule,
    BillingModule,
    SettingsModule,
    PlatformAdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
