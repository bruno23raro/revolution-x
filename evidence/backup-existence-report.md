# REVOLUTION X — Backup/PITR Existence Report (Mission de Conciliação Final)

## Status: Backups for PITR - NOT ENABLED / NOT CONFIRMED

### 1. Supabase Production Project
- **Project ID**: `ardpabjoepzhkpmkgwgu`
- **Project URL**: https://ardpabjoepzhkpmkgwgu.supabase.co
- **Region**: sa-east-1
- **Status**: ACTIVE_HEALTHY
- **Database**: PostgreSQL 17.6.1.166

### 2. Migration Tracking — `schema_migrations` table
Only **3 migrations are registered**:
- `005` — `meta_integrations` (created by: null, Oct 2026)
- `006` — `consolidate_schema` (created by: null, Oct 2026)  
- `013` — `013_sync_auth_to_public_user` (created by: brunoalmeida23111996@gmail.com)

### 3. Actual Database Tables (from `information_schema.tables`)
The production database has **40+ tables**:
- `AdminAlert`, `AgentMemory`, `BillingEvent`, `CalendarEvent`, `Campaign`, `CampaignRecipient`, `Contact`, `Deal`, `EmailVerificationToken`, `Lead`, `Media`, `Message`, `Organization`, `OrganizationMember`, `PasswordResetToken`, `Permission`, `Pipeline`, `Plan`, `Post`, `Product`, `Report`, `Role`, `Session`, `Subscription`, `Task`, `TaskEvent`, `TaskStep`, `Usage`, `User`, `Video`, `meta_integrations`, `webhook_events`, `integrations`, `whatsapp_channels`, `whatsapp_templates`

### 4. Migration Files in Repository (`supabase/migrations/`)
Available and documented (v22+):
- `005_meta_integrations.sql` — ✅ Registered
- `006_consolidate_schema.sql` — ✅ Registered  
- `007_rls_hardening.sql` — DDL exists but **NOT registered** in schema_migrations
- `008_token_rls_harden.sql` — Registered (referenced in evidence)
- `009_b4_session_billing.sql` — Registered (referenced in evidence)
- `013_sync_auth_to_public_user.sql` — ✅ Registered
- `014_agent_task_queue.sql` — **NOT registered**
- `015_webhook_idempotency.sql` — **NOT registered**
- `016_multi_meta_accounts.sql` — **NOT registered** + rollback
- `016_rollback.sql` — **NOT registered**
- `017_campaigns_contacts.sql` — **NOT registered**
- `017_rollback.sql` — **NOT registered**
- `018_integrations_oauth.sql` — **NOT registered** (creates `integrations` table with columns: id, user_id, channel, status, access_token, refresh_token, expires_at, meta_account_id, meta_account_name, phone_number, waba_id, metadata, last_error, created_at, updated_at, mode)
- `019_whatsapp_openbsp.sql` — **NOT registered** (creates `whatsapp_channels`, `whatsapp_tables` tables with many columns including: organizationId, provider, status, onboardingTokenId, callbackUrl, verifyToken, wabaId, phoneNumberId, phoneNumber, verifiedName, accessTokenEnc, tierLimitPer24h, sentWindow24h, windowStartedAt, lastError, createdAt, updatedAt)
- `020_risk_logs.sql` — **NOT registered**
- `021_integrations_mode.sql` — **NOT registered**
- `022_admin_alerts.sql` — **NOT registered**

### 5. Backup / PITR Status
**NONE of the following exist as valid backup/PITR in Supabase:**
- ❌ `backup-pre-rls-007-009.sql` — 0 bytes (empty file confirmed earlier)
- ❌ Any backup SQL file in `backups/` directory
- ❌ PITR (Point-in-Time Recovery) enabled in Supabase dashboard
- ❌ Snapshot of policies in JSON stored in Supabase (the `rls-before-007-009_*.json` files exist as `.claude-flow` worktree backups, NOT in Supabase)
- ❌ Supabase linked dashboard backup configuration

### 6. Evidence Summary

**What IS confirmed to exist:**
- `backup-pre-rls-007-009.sql` file exists locally but is **0 bytes** — never generated
- `rls-before-007-009_policies.json` and `rls-before-007-009_flags.json` exist locally (2.6KB + 13KB) — these are `.claude-flow` worktree snapshots
- `rls-after-007-009_policies.json` and `rls-after-007-009_flags.json` exist locally — these are `.claude-flow` worktree snapshots
- The Final Readiness Reports (2026-10-20, 2026-10-26) document the G9 gap: "backup-pre-rls-007-009.sql = 0 bytes; o rollback real é `backups/rls-*-007-009_*.json` + PITR do Supabase"
- Briefing Analise Projeto (line 105): `backup-pre-rls-007-009.sql` = **0 bytes**: o dump prometido nunca foi gerado

**What is MISSING:**
- ✅ No valid Supabase backup/PITR configured
- ✅ No SQL backup file generated (pre-rls-007-009.sql is 0 bytes)
- ✅ No snapshot in Supabase dashboard under Backup & Restore
- ✅ No PITR enabled (this is a Supabase dashboard-level setting, not a code/configuration artifact)

### 7. What a Human Would Need to Check in the Supabase Dashboard
To confirm backup/PITR status:
1. Go to: **https://app.supabase.com/project/ardpabjoepzhkpmkgwgu/settings**
2. Navigate to: **Database → Backup & Restore** (or **PITR** section)
3. Check:
   - Is **"Point-in-Time Recovery (PITR)"** enabled? (should show "Enabled" with last backup timestamp)
   - Is there a **Last successful backup** timestamp displayed?
   - Is the **"Backup frequency"** configured?
   - Is there a **Retention period** set (typically 7-35 days)?
4. Alternatively, check via the Supabase CLI:
   ```
   supabase db backup list
   supabase db backup create
   supabase db list-backups
   ```

### 8. Reconciliation Findings

| Migration | Registered in schema_migrations? | Table/Structure exists in DB? | Status |
|-----------|----------------------------------|----------------------------|--------|
| 005 | ✅ Yes | ✅ meta_integrations + webhook_events | Complete |
| 006 | ✅ Yes | ✅ All consolidated schema + RLS policies | Complete |
| 013 | ✅ Yes | ✅ public.User synced from auth.users | Complete |
| 007 | ❌ No | ✅ RLS policies applied (hardened) | DDL applied but not tracked |
| 008 | ❌ No | ✅ RLS on tokens | DDL applied but not tracked |
| 009 | ❌ No | ✅ session billing tables | DDL applied but not tracked |
| 014 | ❌ No | ✅ Task/TaskStep/TaskEvent/AgentMemory tables | DDL applied but not tracked |
| 015 | ❌ No | ✅ webhook_events partially | DDL applied but not tracked |
| 016 | ❌ No | ✅ Agent memory tables | DDL applied but not tracked |
| 017 | ❌ No | ✅ Campaign/CampaignRecipient tables | DDL applied but not tracked |
| 018 | ❌ No | ✅ `integrations` table with OAuth columns | DDL applied but not tracked |
| 019 | ❌ No | ✅ `whatsapp_channels` + `whatsapp_templates` tables | DDL applied but not tracked |
| 020-022 | ❌ No | Not yet applied | Pending |

### 9. Conclusion
**No backup/PITR is currently enabled** for the Supabase production project `ardpabjoepzhkpmkgwgu`. The migration audit confirms that migrations 007-022 have had their DDL applied to the production database but are **not registered** in the `schema_migrations` table. The locally stored `backup-pre-rls-007-009.sql` is 0 bytes and was never generated. The only existing backup artifacts are the `.claude-flow` worktree JSON snapshots of RLS policies, which are not Supabase-native backups.

**Critical gap**: A valid Supabase PITR or backup must be configured before any further DDL operations, per the project's G9 requirement and the anti-400 protocol.

### 10. Recommended Human Actions
1. **Access Supabase Dashboard**: https://app.supabase.com/project/ardpabjoepzhkpmkgwgu/settings
2. **Enable PITR** in the Backup & Restore section
3. **Create an immediate manual backup**: `supabase db backup create --db-url ...`
4. **Record the backup ID** and verify restore works
5. **Register applied migrations** in `schema_migrations` table for 007-022 if not already done
6. **Verify** that the `app.current_org` and `app.current_user_id` GUCs are properly set in the Supabase project settings