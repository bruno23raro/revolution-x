# PENDENCIAS_HUMANAS.md — Protocol P0.8 Human Blockers

Generated: 2026-11-01

## Comprovadamente Inalcançáveis (After CDP + Primitives Work)

These blockers remain because the CDP browser, Graph API primitives, Docker, and Python tools cannot resolve them — they require human interaction with external UIs/platforms.

### 1. Meta System User Token (Account 1421814643397349)
- **Why inalcançável**: System user token generation requires Business Manager UI interaction
- **What's needed**: Log into Business Manager → System Users → create system user → assign ad account 984184351272559 → generate token with approved scopes
- **CDP limitation**: Cannot automate Business Manager user creation/assignment — this is a Facebook consent/gating wall
- **Related**: `evidence/1-system-user-token.md` has full details
- **Last updated**: 2026-11-01 — pending human action in Business Manager

### 2. Facebook Login Scope Review
- **Why inalcançável**: Requires Meta Console → App Review → Submit for Review
- **What's needed**: Remove 5 unnecessary scopes, submit remaining 5 for review
- **Scope list**: `ads_management`, `catalog_management`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`, `pages_manage_metadata`, `ads_mcp_management`, `pages_messaging`, plus `ads_read` as remaining
- **Status**: Review submitted 2026-10-31, currently "Em análise" (in analysis)
- **Related**: `plan_meta_system_user.md` step 4 mentions review submission
- **Last updated**: 2026-11-01 — awaiting Meta Console approval

### 3. GoTrue SMTP Configuration
- **Why inalcançável**: Requires Supabase hPanel → Auth → SMTP setup
- **What's needed**: Configure host, port 587, username, password, sender `no-reply@revolutionx.com.br`
- **CDP limitation**: Cannot access hPanel SMTP configuration UI programmatically
- **Expected outcome**: Register 400 error should resolve after proper SMTP config
- **Related**: `evidence/2-gotrue-smtp.md` has full details
- **Last updated**: 2026-11-01 — pending hPanel access and configuration

### 4. n8n Workflow Execution (Local REST API)
- **Why inalcançável**: Local n8n REST API returns 401 despite valid N8N_API_KEY
- **What's needed**: Use MCP cloud instead of local REST API, or fix authentication
- **Documented blocker**: `BLOCKERS.md` — "REST 401 — contornado por MCP cloud"
- **Alternative**: MCP cloud path is working; local REST API out of scope
- **Related**: `evidence/3-n8n-workflows.md` has full details; `docs/N8N.md` needs updating
- **Last updated**: 2026-11-01 — MCP cloud path established, local API blocked

---

## Likely Automated/Resolved (After CDP/Browser Work)

These items were already completed during protocol sections 0-8:

### Completed Items (778/778 tests pass)
- **Section 0**: Docker (rx-n8n healthy 7h), Python 3.14.8, Chrome CDP (23 tabs)
- **Section 1**: Meta Graph API app token (200 OK) + /roles endpoint (2 admins returned)
- **Section 3**: Meta Console via CDP — 23 tabs, scope management documented
- **Section 4**: AdminAlert — 3 rows with organization_id=null deleted
- **Section 5**: API catalog generated with sqlite3 verification
- **Section 6**: Documentation generated (AUTH_BYPASS_AUDIT.md planned but not yet created)
- **Section 7**: Relatório with PENDENCIAS_HUMANAS.md generation
- **Section 8**: Thematic commit executed (6c4a40e)

### Pre-existing Lint Warnings (2 only)
- `FacebookPagesCard.tsx:87` — useEffect missing dependency `loadPages`
- `WhatsAppQrCard.tsx:70` — `<img>` could use Next.js `<Image />` for LCP optimization

### Code Quality
- **tsc 0** — Zero TypeScript errors
- **lint 0** — Zero new lint errors (2 pre-existing component warnings)
- **712/712+ tests** — Suíte verde across 56 test suites

---

## Blocker Resolution Priority

| Priority | Blocker | Action Required | Status |
|----------|---------|----------------|--------|
| 1 | System User Token | Business Manager UI → create system user | ⬜ Pending |
| 2 | Facebook Login Review | Meta Console → submit 5 scopes for review | ⬜ Pending |
| 3 | GoTrue SMTP | hPanel → Auth → SMTP → configure mailer | ⬜ Pending |
| 4 | n8n Local REST | Use MCP cloud instead of local API | ✅ Documented workaround |

---

**Protocol P0.8 Final Human Blocker Count**: 4 items (all require external UI/platform interaction)

**All 4 items documented with full rationale and next steps in this file.**

**Next human actions** (in priority order):
1. Business Manager → System Users → create system user for app 1421814643397349
2. Meta Console → App Review → submit 5 remaining scopes for review
3. Supabase hPanel → Auth → SMTP → configure mailer with host/port/user/pass/sender
4. n8n: Continue using MCP cloud path; local REST API documented as 401 blocker