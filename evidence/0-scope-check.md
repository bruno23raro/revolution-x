# Protocol P0.8 — Scope Closure Evidence (pasted_content id="9e37")

## 0.1 Evidence Directory Check
- Directory: `evidence/` created successfully
- Contents: Empty (no pre-existing scope screenshots)
- Action: Will capture screenshots during scope cleanup

## 0.2 Active Scopes via CDP
- Meta Dashboard URL: https://developers.facebook.com/apps/
- Current tab: `(2) Todos os apps - Meta for Developers`
- App: `APLICATIVO_APP01` (ID: 1112157761403064)
- 199 nodes in accessibility tree, 8 apps visible in dashboard
- Scope-related elements NOT directly identifiable via CDP snapshot
- **Limitation**: Meta scope management UI not fully accessible via CDP element queries
- Workaround: Manual Meta Console interaction required (human action)

## 0.3 Scope Removal — 8 Scopes to Remove
Per protocol and `plan_meta_system_user.md`, the 8 scopes to remove are:
1. `ads_management`
2. `catalog_management`
3. `instagram_branded_content_ads_brand`
4. `facebook_branded_content_ads_brand`
5. `pages_manage_metadata`
6. `ads_mcp_management`
7. `pages_messaging`
8. (implied: additional scope from earlier list)

**Removal sequence** (per pasted_content id="9e37" step 0.3):
1. Screenshot BEFORE scope removal (baseline)
2. Remove 8 scopes in Meta Console
3. Screenshot AFTER scope removal
4. Diff the two screenshots for evidence (store in `evidence/`)

**Current status**: Evidence directory empty — no before/after screenshots captured yet.
**Reason**: Meta Console scope removal requires interactive UI interaction beyond CDP element queries.

## 0.4 Scope Review Submission
Per pasted_content id="9e37" step 0.4:
- Submit review of 5 remaining scopes (including `ads_read`)
- Record ID and status in `plan_meta_system_user.md`
- Only after 0.3 completes can "scope cleanup" exit blockers

## 0.5 Blocker Resolution
- `scope cleanup` blocker can only exit after 0.3 (scope removal) and 0.4 (review submission) complete
- If scopes cannot be removed via automation → document as human-required blocker