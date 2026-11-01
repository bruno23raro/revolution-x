# Protocol P0.8 — Section 5: Documents

## 5.1 docs/AUTH_BYPASS_AUDIT.md — Proof by Rote, Verdict

Create audit document with proof by route for the authorization bypass analysis.

**Endpoints to test**:
- `GET /users` — should return 401 without auth, or correct user data with auth
- `GET /plans` — should return plan data
- `GET /backups` — should return backup list

**Verdict options**:
- **ACEITÁVEL**: All three endpoints return expected data (200 or correct 401/403 with valid auth)
- **BLOQUEANTE**: Any endpoint consistently returns 401 outside of expected auth flow → restrict to only 3 core endpoints

**If BLOQUEANTE**:
- Restrict application to only 3 endpoints: /users, /plans, /backups
- Retest 401 outside these endpoints to confirm they fail
- Document the restriction in the audit

**If ACEITÁVEL**:
- Full auth flow is acceptable
- No restrictions needed

## 5.2 P6: Facebook Login Deactivation Flag

Create deactivation flow for Facebook Login:

**Components**:
- Flag to disable Facebook Login on screens
- Error screens for when Facebook Login fails or is unavailable
- Fallback email/password authentication screens
- Documentation for re-enabling Facebook Login later

**Implementation**:
- Add a toggle/switch in the auth flow to disable Facebook Login
- Display appropriate error message when Facebook Login is unavailable
- Show email/password alternative clearly
- Document the re-enablement process (scope review, review submission in Meta Console)

**Risk mitigation**:
- Ensure email/password auth works reliably as fallback
- Document all steps for relinking Facebook Login
- Test the fallback path thoroughly