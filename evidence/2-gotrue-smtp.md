# Protocol P0.8 — GoTrue SMTP Closure (pasted_content id="9e37")

## 2.1 SUPABASE_ACCESS_TOKEN Check
- **Step 2.1**: Check if `SUPABASE_ACCESS_TOKEN` exists
- **Current state**: Need to verify via `.env.local` or Supabase MCP
- **Path forward**: If token exists → Management API first; if not → proceed to hPanel SMTP

## 2.2 hPanel → Auth → SMTP Configuration
Per pasted_content id="9e37" step 2.2:
- **host**: SMTP host from Supabase (typically `smtp-relay.sendinblue.com` or similar)
- **port**: 587
- **usuário**: SMTP username from Supabase dashboard
- **senha**: SMTP password from Supabase dashboard
- ** remetente**: `no-reply@revolutionx.com.br`

**Current state**: SMTP not yet configured in hPanel
**Action**: Access Supabase hPanel → Auth → SMTP → enter the above credentials

## 2.3 Prove with Real Register
Per pasted_content id="9e37" step 2.3:
- After SMTP config → attempt real user registration
- **Expected**: Register 400 error should be resolved
- **Evidence**: Successful registration flow with test user

## 2.4 If 400 Persists
Per pasted_content id="9e37" step 2.4:
- If 400 error persists WITH SMTP configured → the cause is different
- **Action**: Read the GoTrue log and correct the real cause (not the presumed one)
- **Common causes** (beyond SMTP):
  - Missing `EMAIL_API_KEY` / `EMAIL_FROM` in `.env`
  - GoTrue configuration issues in Supabase project settings
  - Database-level issues (user confirmation policies, email confirm settings)

## 2.5 Blocker Status
- **Status**: PENDING — requires hPanel access and SMTP configuration
- **Documentation**: Will record exact error if 400 persists after SMTP config
- **Dependency**: SMTP configuration is prerequisite for user registration flow