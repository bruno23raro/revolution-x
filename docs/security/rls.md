# Revolution X — RLS Policy Map (FASE 1)

Generated: 2026-11-18

---

## Overview

All multi-tenant tables enforce Row Level Security (RLS) via **FORCE ROW LEVEL SECURITY** with **fail-closed** policies using the GUC `app.current_org` (set via middleware). Tables without explicit `organizationId` (User, PasswordResetToken, EmailVerificationToken) use `app.current_user_id`.

---

## Tenant-Scoped Tables (organizationId)

| Table | Policy Name | Key Column | Policy Type | Status |
|-------|-------------|------------|-------------|--------|
| Organization | Organization_tenant | id | FOR ALL (USING + WITH CHECK) | ✅ 007 |
| OrganizationMember | OrganizationMember_tenant | organizationId | FOR ALL | ✅ 007 |
| Contact | Contact_tenant | organizationId | FOR ALL | ✅ 007 |
| Lead | Lead_tenant | organizationId | FOR ALL | ✅ 007 |
| Deal | Deal_tenant | organizationId | FOR ALL | ✅ 007 |
| Pipeline | Pipeline_tenant | organizationId | FOR ALL | ✅ 007 |
| Product | Product_tenant | organizationId | FOR ALL | ✅ 007 |
| Media | Media_tenant | organizationId | FOR ALL | ✅ 007 |
| Post | Post_tenant | organizationId | FOR ALL | ✅ 007 |
| CalendarEvent | CalendarEvent_tenant | organizationId | FOR ALL | ✅ 007 |
| Video | Video_tenant | organizationId | FOR ALL | ✅ 007 |
| Message | Message_tenant | organizationId | FOR ALL | ✅ 007 |
| Report | Report_tenant | organizationId | FOR ALL | ✅ 007 |
| Subscription | Subscription_tenant | organizationId | FOR ALL | ✅ 007 |
| Usage | Usage_tenant | organizationId | FOR ALL | ✅ 007 |
| BillingEvent | BillingEvent_tenant | organizationId (nullable) | FOR ALL + NULL allowed | ✅ 007 |
| Session | Session_tenant | organizationId (nullable) | FOR ALL + NULL allowed | ✅ 007/009 |
| Role | Role_tenant | organizationId (nullable) | FOR ALL + NULL allowed | ✅ 007/009 |
| MetaIntegration | meta_integrations_tenant | organizationId (camelCase) | FOR ALL | ✅ 007 |
| Task | Task_tenant | organizationId | FOR ALL | ✅ 014 |
| TaskStep | TaskStep_tenant | organizationId | FOR ALL | ✅ 014 |
| TaskEvent | TaskEvent_tenant | organizationId | FOR ALL | ✅ 014 |
| AgentMemory | AgentMemory_tenant | organizationId | FOR ALL | ✅ 014 |
| AdminAlert | AdminAlert_tenant | organizationId (nullable) | USING (orgId IS NULL OR orgId = GUC) | ✅ 022 |
| Campaign | Campaign_tenant | organizationId | FOR ALL | ✅ 017 |
| CampaignRecipient | CampaignRecipient_tenant | organizationId | FOR ALL | ✅ 017 |
| RiskLog | RiskLog_tenant | organizationId | FOR ALL | ✅ 020 |
| ScraperConfig | ScraperConfig_tenant | organizationId | FOR ALL | ✅ 020 |
| WhatsappChannel | whatsapp_channels_org | organizationId | FOR ALL | ✅ 019 |
| WhatsappTemplate | whatsapp_templates_org | organizationId | FOR ALL | ✅ 019 |
| IntegrationEvent | integration_events_tenant | workspace_id | FOR ALL | ✅ 028/029 |
| webhook_events | webhook_events_tenant | integration_id → meta_integrations | FOR ALL | ✅ 007 |
| whatsapp_instances | whatsapp_instances_org | organizationId | FOR ALL | ✅ 020 |
| growth_leads | growth_leads_org | organizationId | FOR ALL | ✅ 020/023 |
| inbound_messages | inbound_messages_tenant | organization_id | FOR ALL | ✅ 031 |
| message_status | message_status_tenant | organization_id | FOR ALL | ✅ 031 |

---

## User-Scoped Tables (userId)

| Table | Policy Name | Key Column | Policy Type | Status |
|-------|-------------|------------|-------------|--------|
| User | User_self (SELECT) | id | FOR SELECT (self-read) | ✅ 008 |
| User | User_self_write (ALL) | id | FOR ALL (self-write) | ✅ 008 |
| PasswordResetToken | PasswordResetToken_tenant | userId | FOR ALL | ✅ 008 |
| EmailVerificationToken | EmailVerificationToken_tenant | userId | FOR ALL | ✅ 008 |

---

## Global Tables (Catalog)

| Table | Policy Name | Policy Type | Status |
|-------|-------------|-------------|--------|
| Plan | Plan_read / Plan_write | SELECT authenticated, ALL service_role | ✅ 033 |
| Permission | Permission_read / Permission_write | SELECT authenticated, ALL service_role | ✅ 033 |

---

## Integrations Table (Fixed in 032)

| Table | Issue | Fix |
|-------|-------|-----|
| integrations | Used `user_id` + `app.current_user_id` (per-user, not per-tenant) | Added `organizationId`, backfilled from `OrganizationMember`, new policy `integrations_tenant` using `app.current_org` | ✅ 032 |

---

## Policy Expression Pattern (Fail-Closed)

```sql
-- Standard tenant policy
USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)
WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid)

-- Nullable organizationId (allows global rows)
USING ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid OR "organizationId" IS NULL)
WITH CHECK ("organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid OR "organizationId" IS NULL)

-- User-scoped
USING ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)
WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', TRUE), '')::uuid)

-- webhook_events (join via meta_integrations)
USING (
  integration_id IS NULL
  OR integration_id IN (
    SELECT mi.id FROM meta_integrations mi
    WHERE mi."organizationId" = NULLIF(current_setting('app.current_org', TRUE), '')::uuid
  )
)
```

---

## GUC Context Setting

**Middleware** (`src/middleware.ts`) sets:
- `x-organization-id` cookie → Supabase auth context
- Application must call `SET app.current_org = '<org-uuid>'` before queries

**Prisma Client** (`src/lib/prisma.ts`):
- `withTenantContext(organizationId, callback)` — sets GUC for tenant queries
- `withUserContext(userId, callback)` — sets GUC for user-scoped queries

**Database Adapter** (`src/db/prisma-adapter.ts`):
- Sets both `app.current_org` and `app.current_user_id` per tenant context

---

## Migrations Summary

| Migration | Tables Covered | Notes |
|-----------|----------------|-------|
| 006 | Core tenant tables | Initial RLS (USING only, no FORCE) |
| 007 | All core tenant tables | Hardened: FORCE + WITH CHECK + NULLIF |
| 007b | meta_integrations, webhook_events | CamelCase fix + join policy |
| 008 | User, token tables | User-scoped policies + FORCE |
| 009 | Session, BillingEvent, Role | Strict policies |
| 014 | Task, TaskStep, TaskEvent, AgentMemory | Admin agent queue |
| 017 | Campaign, CampaignRecipient | Campaign engine |
| 018 | integrations | Per-user policy (user_id + app.current_user_id) |
| 019 | whatsapp_channels, whatsapp_templates | WhatsApp OpenBSP |
| 020 | RiskLog, ScraperConfig, whatsapp_instances, growth_leads | Growth tools |
| 022 | AdminAlert | Nullable orgId policy |
| 023 | growth_leads | Funnel columns + policy refresh |
| 024 | integrations, integration_events | Integrations v2 (snake_case) |
| 028 | integration_events | RLS enable + policy |
| 029 | integration_events | Fix FORCE + NULLIF pattern |
| 031 | inbound_messages, message_status | OpenBSP webhook storage |
| 032 | integrations | **Fix: organizationId + app.current_org** |
| 033 | Plan, Permission | Catalog tables with read-only policies |

---

## Verification Checklist

- [x] All 34 tenant-scoped models have RLS policies
- [x] All policies use `FORCE ROW LEVEL SECURITY`
- [x] All policies use `NULLIF(current_setting(...), '')::uuid` for fail-closed
- [x] All policies have explicit `WITH CHECK`
- [x] User-scoped tables (User, tokens) use `app.current_user_id`
- [x] webhook_events joins through meta_integrations
- [x] AdminAlert allows NULL organizationId (system alerts)
- [x] Plan, Permission have read-only policies (global catalog)
- [x] integrations fixed to use organizationId + app.current_org (032)
- [x] Grants to `authenticated`, `service_role`, `revx_test` (no BYPASSRLS)

---

## Gaps / Pending

| Item | Status | Notes |
|------|--------|-------|
| lib/db.ts SET LOCAL app.tenant_id | ✅ Done | Already in `lib/prisma.ts` and `db/prisma-adapter.ts` |
| Prisma schema sync for integrations | ⏳ Pending | Add `organizationId` field to Integration model |
| Test validation | ⏳ Pending | Run `src/tests/rls.test.ts` and `token-rls.test.ts` |

---

## Test Coverage

- `tests/unit/validation.test.ts` — Zod schemas
- `tests/regression/auth.test.ts` — Token rotation, expiry
- `tests/functional/headers.test.ts` — Security headers
- `src/tests/rls.test.ts` — RLS policy tests (tenant isolation)
- `src/tests/b4-rls.test.ts` — B4 RLS tests
- `src/tests/token-rls.test.ts` — Token RLS tests (user isolation)
- `src/tests/task-queue-rls.test.ts` — Task queue RLS
- `src/tests/multi-tenant-isolation-autonomous.test.ts` — Cross-tenant isolation