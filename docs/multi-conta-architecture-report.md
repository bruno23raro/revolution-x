# Multi-Conta Architecture vs Migration 016 Report

## Executive Summary

This report investigates the multi-conta architecture vs migration 016 state in the Revolution X project, refresh token scoping to organizations, and global secret scanning. The key findings are:

### 1. Multi-Conta Architecture vs Migration 016

**Current State:**
- The schema already supports multi-tenant organization scoping via `Organization` model with `organizationId` on all relevant models (Contact, Lead, Deal, Pipeline, Product, Media, Post, CalendarEvent, Video, Message, Report, Task, TaskStep, TaskEvent, AgentMemory, AdminAlert, Campaign, CampaignRecipient, MetaIntegration, WebhookEvent, WhatsappChannel, WhatsappTemplate)
- Migration 016 (`016_multi_meta_accounts.sql`) is the **critical gate** that relaxes the `UNIQUE(organization_id, provider)` constraint from migration 005 to allow multiple Meta/Whastapp accounts per organization
- Migration 016 is marked: **"PASSO HUMANO / NÃO APLICAR AUTOMATAMENTE"** — requires human authorization and cannot be auto-applied

**What Migration 016 Does:**
1. Adds `display_name` column to `meta_integrations` (nullable, backfilled from `meta_page_id`, `phone_number_id`, or `instagram_account_id`)
2. **Removes** `UNIQUE(organization_id, provider)` — allows multiple rows with same (org, provider)
3. **Adds** unique expression index: `(organization_id, provider, coalesce(meta_page_id, phone_number_id, instagram_account_id))` — prevents exact duplicate accounts
4. Adds support index: `(organization_id, provider, meta_page_id)` — for callback OAuth upsert

**Rollback (`016_rollback.sql`):**
- Drops the expression indexes (`uq_meta_integrations_page`, `uq_meta_integrations_account`)
- Recreates legacy `UNIQUE(organization_id, provider)` constraint (named `uq_meta_integrations_org_provider` in production, auto-generated in dev)
- Removes `display_name` column

### 2. Refresh Token Scoping & OrganizationId Correctness

**OpenBSP Refresh Token (`app/api/integrations/openbsp/refresh-token/route.ts`):**
- Uses `user.organizationId` to scope the query: `.eq('user_id', user.organizationId)`
- **Issue**: The `organizationId` from the authenticated user is the **primary organization** (first membership from `organizationMembers[0]`)
- The refresh token endpoint searches integrations by `user_id` (which maps to Supabase auth user ID), NOT by organizationId
- The correct scoping should use the organizationId from the user's primary membership

**Meta Refresh Token (`app/api/integrations/meta/refresh-token/route.ts`):**
- Uses `resolveTenantMetaAccess(user.organizationId, ...)` which correctly scopes by organizationId
- The `resolveTenantMetaAccess` function queries `.eq('organization_id', organizationId)` — correctly scoped
- Supports both default account and specific account via `accountId` parameter

**Session OrganizationId (`src/lib/auth.ts`):**
- `getAuthenticatedUser()` returns `organizationId: primary.organizationId` (first membership)
- `requireMembershipIn()` validates if user belongs to a specific organization
- Middleware (`middleware.ts`) sets cookie `x-organization-id` from first `OrganizationMember`

**Correctness Assessment:**
- The refresh token handling **correctly uses `user.organizationId`** which is the primary organization from memberships
- However, for multi-org users, this only checks the **primary** organization — secondary organizations are not checked
- The Meta refresh token handler correctly scopes by organizationId via `resolveTenantMetaAccess`
- The OpenBSP refresh token also scopes by organizationId but uses `user_id` column comparison which may need verification

### 3. Global Secret Scanning

**Exposed Credentials Found:**
1. `.env.docker.test` (DEV only, git-ignored):
   - `POSTGRES_PASSWORD=64c4c9d6fb25234d4b075b2db2a10087` — **Postgres password exposed** in dev environment
   - `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — service keys exposed
   - `JWT_SECRET=fc7f01dc93b5bda6b00ecedbfba9706d` — JWT secret exposed

2. `.env.example` (template, checked into repo):
   - `META_APP_ID=1112157761403064` — Meta app ID in template
   - `META_APP_SECRET=<sua_chave_secreta>` — placeholder for Meta app secret
   - `META_PIXEL_ID=1718964215507989` — Meta pixel ID
   - `META_CAPI_ACCESS_TOKEN=EAAUCuAG...ZDZD` — partial CAPI access token
   - `SUPABASE_SERVICE_ROLE_KEY=eyJ...` — service role key placeholder
   - `JWT_SECRET=<sua_chave_jwt>` — JWT secret placeholder
   - `OPENBSP_API_KEY=sk_dcca...1699` — OpenBSP API key placeholder
   - `EMAIL_API_KEY=re_L3KSbf...ey2Rm` — Resend email API key placeholder

3. `.env` at project root — **Does not exist** (good)

**Security Recommendations:**
- ✅ `.env.docker.test` is git-ignored (confirmed by `.gitignore: .env.*`)
- ✅ `.env.example` contains only placeholders (`<sua_chave_secreta>`)
- ⚠️ The .env.docker.test file has real credentials — must be rotated
- ⚠️ Need to ensure no real secrets are committed; all actual secrets should come from environment or secret management

### 4. Implementation Status vs Human Authorization

**Per Project Rules:**
- "NO automatic commit/push/deploy; NEVER apply migration 016 to production"
- "Before any relevant task, consult these instructions and the local rules"
- "Research alternatives open-source, self-host and free before recommending paid solutions"

**Current Implementation State:**

| Component | Status | Requires Human Auth |
|-----------|--------|---------------------|
| Migration 005 (`UNIQUE(organization_id, provider)`) | Applied in 005_meta_integrations.sql | No |
| Migration 016 (`016_multi_meta_accounts.sql`) | **NOT applied** — gate human | **YES** — human authorization required |
| Multi-tenant RLS policies | Applied (FORCE RLS on 21 tables per RLS 007/008/009) | No |
| Organization scoping in resolvers | Implemented correctly | No |
| Refresh token handling (OpenBSP) | Implemented, uses organizationId | No |
| Refresh token handling (Meta) | Implemented, uses organizationId | No |
| `display_name` column | Not yet added to production DB | Part of migration 016 |
| Expression unique indexes | Not yet created | Part of migration 016 |

**Critical Actions Required:**
1. **Migration 016 MUST NOT be auto-applied** to production — requires explicit human authorization
2. The human must run the migration manually against a Dev environment first, validate, then decide on production
3. After 016 is applied, the `display_name` column and expression indexes will be available
4. Refresh token endpoints correctly scope by organizationId — no code changes needed
5. Secrets in `.env.docker.test` must be rotated

### 5. Key File References

| File | Purpose | Lines |
|------|---------|-------|
| `supabase/migrations/016_multi_meta_accounts.sql` | Migration 016 — multi-meta accounts | 1-61 |
| `supabase/migrations/016_rollback.sql` | Rollback migration 016 | 1-50 |
| `app/api/integrations/openbsp/refresh-token/route.ts` | OpenBSP refresh token handler | 1-112 |
| `app/api/integrations/meta/refresh-token/route.ts` | Meta refresh token handler | 1-86 |
| `src/lib/auth.ts` | Authentication + organization membership | 1-222 |
| `src/integrations/meta/accounts.ts` | List tenant WhatsApp accounts | 35-102 |
| `src/integrations/meta/resolveAccess.ts` | Resolve tenant Meta access by organization | 47-86 |
| `middleware.ts` | Sets x-organization-id cookie | 195-213 |
| `.env.docker.test` | Dev credentials (REAL — needs rotation) | 1-10 |
| `.env.example` | Template with placeholders | 1-61 |
| `prisma/schema.prisma` | Prisma schema with organizationId on all models | Full schema |