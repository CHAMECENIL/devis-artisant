# Devis Artisan — SaaS Backend

NestJS 10 multi-tenant SaaS backend for French BTP artisans.

## Stack

- **Runtime**: Node.js 20 + TypeScript 5
- **Framework**: NestJS 10
- **Database**: PostgreSQL 16 with Row Level Security (RLS)
- **Cache/Queue**: Redis 7 + Bull
- **Storage**: Scaleway Object Storage (S3-compatible)
- **Auth**: JWT + Refresh Token Rotation + Admin 2FA SMS
- **AI**: Anthropic Claude API
- **PDF**: Puppeteer
- **Payments**: Stripe
- **E-Signature**: YouSign (+ internal fallback)
- **Email**: Nodemailer + Bull queues

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+

### 1. Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Start infrastructure

```bash
docker-compose up -d postgres redis
```

### 3. Run migrations

```bash
npm run migrate
```

### 4. Seed initial data (plans)

```bash
npm run seed
```

### 5. Start development server

```bash
npm install
npm run start:dev
```

API available at: `http://localhost:3000/api/v1`  
Swagger docs: `http://localhost:3000/api/v1/docs`

## Production

```bash
docker-compose up -d
```

## Architecture

```
src/
├── common/
│   ├── decorators/        # @CurrentUser, @CurrentTenant, @Public, @Roles, @RequireFeature
│   ├── guards/            # JwtAuth, AdminJwt, Roles, Plan, TenantQuota
│   ├── interceptors/      # TenantContext (RLS), Audit
│   ├── filters/           # HttpException
│   ├── utils/             # EncryptionService (AES-256-GCM)
│   └── dto/               # PaginationDto
├── config/                # database, jwt, redis, storage
├── database/
│   ├── migrations/        # InitialSchema (14 tables, RLS)
│   └── seeds/             # Plans (Bronze/Silver/Gold)
└── modules/
    ├── auth/              # Register, Login, Refresh, Email verification, Reset password
    ├── admin-auth/        # Admin login + 2FA SMS (Twilio)
    ├── users/             # User CRUD, roles
    ├── tenants/           # Tenant CRUD (admin), stats
    ├── clients/           # Client CRUD with devis history
    ├── devis/             # Devis CRUD + AI generation + PDF + Liste achats + CSV
    ├── ai/                # Chat BTP, challenge chiffrage, rentabilité
    ├── pdf/               # Puppeteer PDF generation
    ├── kanban/            # Kanban board with drag & drop
    ├── dashboard/         # Analytics (KPIs, evolution, top clients)
    ├── email/             # Bull queue + Nodemailer (verification, reset, devis, reminders)
    ├── reminders/         # Cron auto-reminders + manual send
    ├── storage/           # S3-compatible (presigned URLs)
    ├── ged/               # Document management (upload, download, delete)
    ├── signature/         # E-signature (YouSign + internal fallback)
    ├── billing/           # Stripe checkout, webhooks, invoices
    ├── settings/          # Tenant settings (AI key, SMTP, Google Maps)
    └── platform-admin/    # Super-admin dashboard, impersonation, audit logs
```

## Security

- **Multi-tenancy**: PostgreSQL RLS — every query is scoped by `app.current_tenant_id`
- **Passwords**: bcrypt cost=12
- **Tokens**: JWT (15min) + Refresh rotation (7 days, family-based replay detection)
- **Admin 2FA**: OTP via SMS (Twilio), Redis TTL 10min, timing-safe comparison
- **API Keys**: AES-256-GCM encryption at rest
- **Rate limiting**: ThrottlerModule (10/s, 100/min, 1000/h)
- **Headers**: Helmet, CORS, compression

## API Reference

Full Swagger documentation available at `/api/v1/docs` when running.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new tenant + admin user |
| POST | `/auth/login` | Login (JWT + refresh token) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/verify-email` | Verify email address |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |

### Devis

| Method | Path | Description |
|--------|------|-------------|
| GET | `/devis` | List devis (paginated, filterable) |
| POST | `/devis` | Create devis manually |
| POST | `/devis/generate` | Generate devis with AI (Claude) |
| GET | `/devis/stats` | KPIs by statut |
| GET | `/devis/:id` | Get devis with lignes |
| PUT | `/devis/:id` | Update devis + lignes |
| DELETE | `/devis/:id` | Delete devis |
| POST | `/devis/:id/duplicate` | Duplicate devis |
| POST | `/devis/:id/send` | Send devis by email |
| GET | `/devis/:id/liste-achats` | Shopping list grouped by supplier |
| GET | `/devis/:id/liste-achats/csv` | Export shopping list as CSV |

### Plans

| Plan | Price | Devis/month | Features |
|------|-------|-------------|----------|
| Bronze | 29€/mo | 10 | Basic devis, PDF |
| Silver | 79€/mo | 50 | + AI, Kanban, GED |
| Gold | 149€/mo | Unlimited | + E-signature, Analytics, API |

## Environment Variables

See `.env.example` for full list. Required variables:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/devis_artisan
REDIS_URL=redis://localhost:6379
JWT_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
ADMIN_JWT_SECRET=<64-char random>
ENCRYPTION_KEY=<64-char hex>
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+33...
```

## CLI Commands

```bash
npm run start:dev      # Development with hot-reload
npm run start:prod     # Production
npm run build          # Compile TypeScript
npm run migrate        # Run pending migrations
npm run migrate:revert # Revert last migration
npm run seed           # Seed plans
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run lint           # ESLint
```
