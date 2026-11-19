# Revolution X — Inventory (FASE 0)

Generated: 2026-11-18

---

## 1. Stack & Versions

**Package Manager**: npm (Node >=18.0.0)

**Runtime**: Next.js 14.2.35 (App Router, standalone output)

| Category | Dependencies |
|----------|--------------|
| **Core** | react 18.3.1, react-dom 18.3.1, next 14.2.35 |
| **Database** | @prisma/client 7.10.1, prisma 7.10.1, @prisma/adapter-pg 7.10.0, pg 8.23.1 |
| **Auth/SSO** | @supabase/ssr 0.12.7, @supabase/supabase-js 2.117.1, bcryptjs 2.4.3, jsonwebtoken 9.0.0 |
| **Security** | helmet 8.3.0, express-rate-limit 8.7.3, @upstash/ratelimit 2.2.1, @upstash/redis 1.41.0 |
| **Queue/Jobs** | bullmq 6.7.2, ioredis 6.0.0, redis 6.3.1 |
| **Monitoring** | @sentry/nextjs 11.11.0, @sentry/tracing 7.120.4, prom-client 15.1.3, pino 10.4.0 |
| **UI** | tailwindcss 3.4.0, lucide-react 1.70.0, recharts 3.10.1, sonner 2.0.8, react-hot-toast 2.6.1 |
| **Forms** | react-hook-form 7.91.0, @hookform/resolvers 7.0.3, zod 4.6.7 |
| **Utils** | uuid 9.0.1 |
| **Dev/Test** | typescript 5.9.3, jest 29.7.0, vitest 5.1.1, @playwright/test 1.65.0, @testing-library/react 16.3.3, supertest 7.3.2, msw 3.0.7 |

**Scripts**:
- `dev` — next dev
- `build` — next build
- `start` — next start
- `lint` — next lint
- `typecheck` — tsc --noEmit
- `test:unit` — jest tests/unit
- `test:regression` — jest tests/regression
- `test:functional` — vitest run tests/functional
- `test:e2e` — playwright test
- `test:all` — typecheck && lint && test:unit && test:regression && test:functional && test:e2e
- `db:migrate` — placeholder (requires DATABASE_URL)
- `db:seed` — placeholder (blocked by infra)
- `audit:deps` — npm audit --audit-level=high

---

## 2. Routes & Handlers (88 API routes)

All routes under `app/api/` with `route.ts` handlers:

| Route | Methods | Protection / Notes |
|-------|---------|-------------------|
| `/api/admin/ai-config` | GET, POST | Admin |
| `/api/admin/alerts` | GET, POST | Admin |
| `/api/admin/chat` | GET, POST | Admin |
| `/api/admin/memory` | GET, POST | Admin |
| `/api/admin/notify-slack` | POST | Admin |
| `/api/admin/notify-whatsapp` | POST | Admin |
| `/api/admin/schema/diff` | GET | Admin |
| `/api/admin/tasks` | GET | Admin |
| `/api/admin/tasks/[id]` | GET, POST | Admin |
| `/api/ai/generate` | POST | Auth |
| `/api/ai/models` | GET | Auth |
| `/api/auth/callback/meta` | GET | OAuth callback |
| `/api/auth/callback/tiktok` | GET | OAuth callback |
| `/api/auth/forgot-password` | POST | Public, rate-limited (10/hr) |
| `/api/auth/login` | POST | Public, rate-limited (10/15min) |
| `/api/auth/logout` | POST | Auth |
| `/api/auth/meta` | GET, POST | OAuth |
| `/api/auth/register` | POST | Public, rate-limited (10/hr) |
| `/api/auth/resend-verification` | POST | Public |
| `/api/auth/reset-password` | POST | Public |
| `/api/auth/session` | GET | Auth |
| `/api/auth/tiktok` | GET, POST | OAuth |
| `/api/auth/verify-email` | POST | Public |
| `/api/campaigns` | GET, POST | Auth, tenant |
| `/api/campaigns/[id]` | GET, POST | Auth, tenant |
| `/api/campaigns/[id]/recipients` | GET | Auth, tenant |
| `/api/crm/contacts` | GET, POST | Auth, tenant |
| `/api/crm/contacts/import` | POST | Auth, tenant |
| `/api/crm/deals` | GET, POST | Auth, tenant |
| `/api/crm/leads` | GET, POST | Auth, tenant |
| `/api/crm/pipelines` | GET, POST | Auth, tenant |
| `/api/cron/openbsp-refresh` | GET, POST | Cron (internal) |
| `/api/cron/tiktok` | GET, POST | Cron (internal) |
| `/api/dev/clear-demo-session` | POST | Dev only |
| `/api/dev/demo-login` | POST | Dev only |
| `/api/dev/status` | GET | Dev only |
| `/api/facebook/publish` | POST | Auth, Meta integration |
| `/api/growth/analytics` | GET | Auth |
| `/api/growth/leads` | POST | Auth |
| `/api/growth/leads/[id]/status` | GET | Auth |
| `/api/instagram/accounts` | GET, POST | Auth, Meta integration |
| `/api/instagram/publish` | POST | Auth, Meta integration |
| `/api/integrations/config` | GET, POST | Auth, tenant |
| `/api/integrations/connect/[channel]` | GET, POST | Auth, tenant |
| `/api/integrations/disconnect` | POST | Auth, tenant |
| `/api/integrations/execute` | POST | Auth, tenant |
| `/api/integrations/health` | GET | Auth, tenant |
| `/api/integrations/manual` | GET | Auth, tenant |
| `/api/integrations/manual/connect` | GET | Auth, tenant |
| `/api/integrations/manual/verify` | GET | Auth, tenant |
| `/api/integrations/meta` | GET, POST | Auth, tenant |
| `/api/integrations/meta/refresh-token` | POST | Auth, tenant |
| `/api/integrations/openbsp/callback` | GET | Webhook |
| `/api/integrations/openbsp/connect` | POST | Auth, tenant |
| `/api/integrations/openbsp/incoming` | POST | Webhook (WhatsApp) |
| `/api/integrations/openbsp/refresh-token` | POST | Auth, tenant |
| `/api/integrations/openbsp/status` | GET | Auth, tenant |
| `/api/integrations/send-campaign/[channel]` | POST | Auth, tenant |
| `/api/integrations/status` | GET | Auth, tenant |
| `/api/integrations/sync-contacts/[channel]` | POST | Auth, tenant |
| `/api/integrations/whatsapp-official/disconnect` | POST | Auth, tenant |
| `/api/integrations/whatsapp-official/status` | GET | Auth, tenant |
| `/api/integrations/whatsapp-official/templates` | GET | Auth, tenant |
| `/api/meta/ads-insights` | GET | Auth, Meta integration |
| `/api/oauth/callback/whatsapp-qr` | GET | OAuth callback |
| `/api/products` | GET, POST | Auth, tenant |
| `/api/schedules` | GET, POST | Auth, rate-limited (100/min) |
| `/api/scrapers/instagram/profile` | GET | Auth |
| `/api/scrapers/risk/log` | POST | Auth |
| `/api/social/growth/extract` | POST | Auth |
| `/api/social/growth/send` | POST | Auth |
| `/api/tiktok/ads-insights` | GET | Auth, TikTok integration |
| `/api/tiktok/analytics` | GET | Auth, TikTok integration |
| `/api/tiktok/publish` | POST | Auth, TikTok integration |
| `/api/tiktok/status` | GET | Auth, TikTok integration |
| `/api/tiktok/tick` | POST | Cron (internal) |
| `/api/webhooks/inbound` | POST | Webhook |
| `/api/webhooks/meta` | POST | Webhook (Meta) |
| `/api/webhooks/openbsp` | POST | Webhook (OpenBSP) |
| `/api/webhooks/whatsapp/inbound` | POST | Webhook (WhatsApp) |
| `/api/whatsapp/accounts` | GET, POST | Auth, tenant |
| `/api/whatsapp/chatbot` | GET, POST, DELETE | Auth, tenant |
| `/api/whatsapp/qr` | GET | Auth, tenant |
| `/api/whatsapp/send` | POST | Auth, tenant |
| `/api/whatsapp/templates` | GET, POST | Auth, tenant |
| `/api/whatsapp/templates/[id]` | GET, PATCH, DELETE | Auth, tenant |
| `/api/whatsapp/templates/[id]/sync` | POST | Auth, tenant |
| `/api/whatsapp/templates/[id]/test` | POST | Auth, tenant |

**Rate Limit Config** (middleware.ts):
- `/api/auth` — 30 req/min
- `/api/auth/login` — 10 req/15min
- `/api/auth/register` — 10 req/hr
- `/api/webhooks` — 2000 req/min
- `/api/schedules` — 100 req/min
- default — 100 req/min

**Security Headers** (src/middleware/helmet.ts):
- CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy

---

## 3. Database & RLS Coverage

**Schema**: `prisma/schema.prisma` (713 lines, 32 models)

**Models with `organizationId` (tenant isolation)** — 28 models:
- OrganizationMember, Role, Permission, Session, Subscription, Usage, BillingEvent
- Contact, Lead, Deal, Pipeline, Product, Media, Post, CalendarEvent, Video, Message, Report
- MetaIntegration, Task, TaskStep, TaskEvent, AgentMemory, AdminAlert
- Campaign, CampaignRecipient, RiskLog, ScraperConfig, WhatsappChannel, WhatsappTemplate, IntegrationEvent

**Models WITHOUT `organizationId`** — 4 models:
- Plan (global reference table)
- User (global, linked via OrganizationMember)
- PasswordResetToken, EmailVerificationToken (linked via User)

**RLS Status**:
- Prisma schema has no RLS policies defined (handled at Supabase/PostgreSQL level via migrations)
- Multi-tenant isolation enforced via `organizationId` on all tenant-scoped models
- Middleware sets `x-organization-id` cookie from authenticated user's org membership
- WebhookEvent and MetaIntegration use snake_case table mapping (`@@map`) for production parity

---

## 4. Integrations

| Integration | Channel | Status | Key Files |
|-------------|---------|--------|-----------|
| **Meta (Facebook/Instagram/WhatsApp)** | Graph API, OAuth | Active | `src/integrations/meta/`, `app/api/auth/meta/`, `app/api/integrations/meta/` |
| **WhatsApp Official (OpenBSP)** | Webhook, Cloud API | Active | `src/integrations/openbsp/`, `app/api/integrations/openbsp/`, `app/api/webhooks/openbsp/` |
| **WhatsApp QR (non-official)** | Evolution API | Legacy/Deprecated | `app/whatsapp/qr/`, `src/integrations/whatsapp/` |
| **TikTok Business** | OAuth, Ads API | Partial | `app/api/auth/tiktok/`, `app/api/tiktok/`, `src/jobs/tiktokScheduler.ts` |
| **Resend (Email)** | Magic links, notifications | Configured | `src/lib/email/` (referenced) |
| **Supabase** | Auth, Database, Realtime | Active | `src/lib/supabase/`, middleware.ts |
| **Upstash Redis** | Rate limiting | Active | middleware.ts (RATE_LIMITS) |
| **Sentry** | Error tracking, tracing | Active | next.config.mjs, @sentry/nextjs |

**Webhooks Registered**:
- `/api/webhooks/meta` — Meta (Facebook/Instagram/WhatsApp)
- `/api/webhooks/openbsp` — OpenBSP (WhatsApp)
- `/api/webhooks/whatsapp/inbound` — WhatsApp inbound messages
- `/api/auth/callback/meta` — Meta OAuth
- `/api/auth/callback/tiktok` — TikTok OAuth
- `/api/oauth/callback/whatsapp-qr` — WhatsApp QR OAuth
- `/api/integrations/openbsp/callback` — OpenBSP connect callback
- `/api/integrations/openbsp/incoming` — OpenBSP incoming messages

---

## 5. Secrets & Config

**Environment Files** (repo/):
- `.env.example` — Template (3403 bytes)
- `.env.local` — Local dev secrets (4945 bytes, gitignored)
- `.env.production` — Production template (2431 bytes)
- `.env-key-verification.md` — Key verification guide (2670 bytes)

**Key Environment Variables** (from .env.example + code references):
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Auth
JWT_SECRET
JWT_REFRESH_SECRET
BCRYPT_COST=12

# Meta
META_APP_ID
META_APP_SECRET
META_WEBHOOK_VERIFY_TOKEN

# TikTok
TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Resend (Email)
RESEND_API_KEY

# Sentry
SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT

# OpenBSP
OPENBSP_BASE_URL
OPENBSP_API_KEY

# App
NEXT_PUBLIC_APP_URL
NODE_ENV
```

**Hardcoded Secret Risks** (found via `process.env.` grep):
- 30+ files reference `process.env.*` directly
- No centralized config validation layer (e.g., Zod schema for env)
- `.env.local` contains actual secrets (not committed)

---

## 6. Broken / Incomplete Files

**TODO/FIXME Markers** (from grep):
| File | Line | Marker |
|------|------|--------|
| `src/integrations/openbsp/provider.ts` | 18 | `TODO openbsp: templates via Meta` |
| `src/integrations/openbsp/adapter.ts` | 955 | `TODO(real): listar templates do WABA via Graph` |
| `src/components/integrations/WhatsAppApiCard.tsx` | 7, 32 | `TODO Meta desativado` (x2) |
| `src/integrations/meta/auth/oauth.ts` | 242 | `TODO: Em produção, o redirectUri...` |
| `src/integrations/meta/oauth-adapter.ts` | 45 | `TODO: Implementar lógica de conexão OAuth completa` |
| `src/jobs/tiktokScheduler.ts` | 381 | Comment: `Roda o cron do agendador para TODOS os tenants...` |

**TypeScript/Build Risks**:
- `src/integrations/openbsp/adapter.ts.backup.20261114_142703` — backup file may cause confusion
- No `tsconfig.json` strictness check run in CI (only local `typecheck` script)

**Test Gaps**:
- `tests/unit/` — 1 file (validation.test.ts)
- `tests/regression/` — 1 file (auth.test.ts)
- `tests/functional/` — 1 file (headers.test.ts)
- `tests/e2e/` — 3 files (integrations-oauth, openbsp-integration, whatsapp-official)

---

## 7. `_refs/` vs `repo/` Diff

**`_refs/` directory**: **DOES NOT EXIST** (confirmed via `ls _refs/` → exit code 2)

**`repo/` directory**: Active codebase created 2026-11-18 14:19
- Contains full Next.js 14 App Router project
- Prisma schema (713 lines, 32 models)
- 88 API routes under `app/api/`
- Middleware with rate limiting, security headers, Supabase auth
- Test structure: unit, regression, functional, e2e
- All env files present

**Conclusion**: Previous references to `_refs/r5/` are stale. Single source of truth is `repo/`.

---

## Summary

| Section | Status |
|---------|--------|
| Stack & Versions | ✅ Documented |
| Routes & Handlers | ✅ 88 routes catalogued |
| Database & RLS | ✅ 28 tenant-scoped models, 4 global |
| Integrations | ✅ 6 active integrations mapped |
| Secrets & Config | ✅ 4 env files, 30+ process.env refs |
| Broken/Incomplete | ⚠️ 7 TODO markers, backup file, no env validation |
| `_refs/` vs `repo/` | ✅ `_refs/` absent, `repo/` is source |

**Next Phase**: FASE 1 — RLS (create migrations for each table without policy)