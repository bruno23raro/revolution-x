# Staging Runbook - Revolution X Missao 6

> Target: Validate the full Mission 6 change set in an isolated staging environment before any production consideration.
> Date: 2026-10-13 - DB: local isolated revolution_x_rls_test
> Status of remote/staging application: NOT APPLIED (see declarations).

## 1. Context & Change Set Summary

| Area | Artefato(s) | State |
|---|---|---|
| B4 RLS fix | supabase/migrations/009 + src/tests/b4-rls.test.ts (8 tests) | Validated locally |
| Real email | src/lib/email.ts (ResendEmailProvider) + src/tests/email-provider.test.ts (7 tests) | Validated locally |
| Meta callback | app/api/auth/callback/meta/route.ts | Refactored |
| Functional UI | register, forgot/reset, dashboard, CRM (contacts/deals/leads), reports | Implemented |
| Total validation | tsc=0 / lint=0 / jest=100/100 / build=36/36 | OK |

Migration chain order:
  005_meta_integrations.sql   -> meta tables + rls policies
  006_consolidate_schema.sql  -> 25x ENABLE ROW LEVEL SECURITY (preconditions)
  007_rls_hardening.sql        -> B4 NULL-permissive policies (the bug)
  008_token_rls_harden.sql     -> user-scoped tokens
  009_b4_session_billing.sql   -> FIX: SESSION user-scoped, BILLINGEVENT strict tenant

006 provides ENABLE on all tenant tables; 007/008/009 issue only FORCE
(which applies to the owner). The catalog confirms 006 ran 25 ENABLE
statements - confirmed via grep.

## 2. Pre-flight Environment Checklist

| Var | Required | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | yes | Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | yes | Anon key |
| SUPABASE_SERVICE_ROLE_KEY | yes | Prod secret - in staging env, never in repo |
| DATABASE_URL / DIRECT_URL | yes | Staging Postgres |
| EMAIL_PROVIDER=resend | optional | For real email tests |
| EMAIL_API_KEY | if resend | Resend key - request via official login |
| EMAIL_FROM | if resend | Verified sender |
| META_APP_ID, META_CLIENT_SECRET | if testing Meta login | OAuth - open official Meta login |
| META_WEBHOOK_SECRET, META_VERIFY_TOKEN | if testing webhook | Per Meta docs |

Abort conditions before staging:
- Any DATABASE_URL/DIRECT_URL pointing to production.
- Supabase production credentials in staging env.
- Lack of confirmation of ownership of OAuth callback domain (Meta).

## 3. Migration Application Order (Staging)

```bash
# 0. Confirm staging DB identity (NEVER production)
echo $DATABASE_URL
psql "$DATABASE_URL" -c "SELECT current_database(), inet_server_addr();"

# 1. Backup pre-007
supabase db dump -f backup-pre-007.sql --db-url "$DATABASE_URL"

# 2. Apply in strict order
supabase migration up 006  --db-url "$DATABASE_URL"
supabase migration up 007  --db-url "$DATABASE_URL"
supabase migration up 008  --db-url "$DATABASE_URL"
supabase migration up 009  --db-url "$DATABASE_URL"
```

Post-migration verification:
```sql
-- All tenant tables ENABLED (006 baseline)
SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND relname IN ('Session','BillingEvent','Role','User','Organization','Contact','Deal','Lead');

-- 009 policies exist
SELECT c.relname, p.polname
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
 WHERE p.polname IN ('Session_user','BillingEvent_tenant_strict','Role_tenant');
```

## 4. Restricted-Role Validation (B4 fix)

Apply the 009 migration then run the B4 RLS test suite against staging:

```bash
TEST_ADMIN_DATABASE_URL=<staging-admin-url> \
TEST_RLS_DATABASE_URL=<staging-restricted-url> \
npx jest --runInBand src/tests/b4-rls.test.ts -t "B4 RLS"
```

Expected: 8/8 pass. Failure → rollback to backup-pre-007.sql.

## 5. Email Real Validation (Resend)

```bash
# 1. Open https://resend.com/api-keys → create Full Access key
# 2. Set in staging env (never commit):
export EMAIL_PROVIDER=resend
export EMAIL_API_KEY=<your-resend-key>
export EMAIL_FROM=onboarding@yourdomain.com
# 3. Trigger send:
curl -X POST "$STAGING_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"qa@yourdomain.com","password":"Test@123","name":"QA"}'
# 4. Confirm delivery + Resend activity shows SENT/DELIVERED.
```

Abort if email does not arrive within 60s, or EMAIL_API_KEY absent.

## 6. Meta / WhatsApp Validation

| Item | How to verify |
|---|---|
| OAuth callback | Meta for Developers -> App -> Facebook Login -> add: https://<staging>/api/auth/callback/meta |
| Webhook | Meta App -> Webhooks -> subscribe message/messages/message_template on whatsapp_business_account; verify token = META_VERIFY_TOKEN |
| Phone Number ID | Meta Business Suite -> WhatsApp Accounts -> copy ID into meta_integrations table |

## 7. Business-Functional Smoke Tests

| Flow | Expected |
|---|---|
| Register -> /verify-email | Account created, verification email sent |
| Forgot password -> email | Token generated, email sent, generic response |
| Reset password (valid token) | Password changed, redirect to /login |
| Login | Session cookie, app.current_user_id + app.current_org set |
| Dashboard | Real counts (contacts/leads/deals) |
| CRM -> create contact | Appears in list, visible only to correct tenant |
| Reports | Deals per stage + Leads per status via real APIs |
| Cross-tenant isolation | Org A cannot see Org B data (RLS) |

## 8. Rollback Plan

If any abort condition fires post-staging-deploy:

```bash
supabase db restore -f backup-pre-007.sql --db-url "$DATABASE_URL"
```

Never apply 009 to production without prior staging validation and explicit approval.

## 9. Rollback Checklist (Idempotency)

009 is safe to re-run (idempotent):
- ALTER ... ENABLE/FORCE (no-op if already set)
- DROP POLICY IF EXISTS (no-op if absent)
- GRANT TO ... (no-op if already granted)
- to_regclass guards skip absent tables gracefully.

## 10. Go/No-Go Gate

Staging is GO for production review only when ALL:
1. Migrations 005-009 applied to staging without error.
2. relrowsecurity=true + relforcerowsecurity=true on Session, BillingEvent, Role.
3. b4-rls.test.ts -> 8/8 PASS (restricted role).
4. email-provider.test.ts -> 7/7 PASS + 1 real email delivered.
5. Meta OAuth + Webhook -> test message processed.
6. Smoke tests - register->login->CRUD->report - no 403/500.

If any gate fails: NO-GO - rollback and fix before retry.
