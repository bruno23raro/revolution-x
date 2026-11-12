# Demo Mode Test Plan — CRM, Growth & Reports

## Objective
Add demo mode fallback responses to all remaining API routes that lack it, following the established patterns from:
- `/api/facebook/publish` 
- `/api/instagram/publish`
- `/api/whatsapp/send`
- `/api/whatsapp/templates`
- `/api/ai/generate`

## Established Demo Pattern
Each demo-enabled route follows this structure:

```typescript
// At the top, after imports
import { demoModeEnabled } from '@/lib/demoMode';

// In the handler, after auth check:
if (demoModeEnabled()) {
  return NextResponse.json({ ok: true, _demo: true, /* demo data */ }, {
    status: 200,
    headers: { 'x-demo-mode': 'true' }
  });
}
```

## Demo Data Conventions
- Use fixed demo identities from `DEMO_IDENTITIES`:
  - `DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'`
  - `DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002'`
  - `DEMO_EMAIL = 'demo@revolutionx.dev'`
- Demo data should be clearly marked as simulation
- No real DB calls in demo mode
- Return `status: 200` with `x-demo-mode: true` header

## Files to Modify

### 1. `app/api/crm/leads/route.ts`
- Add `demoModeEnabled()` check
- Demo GET: Return mock leads array with demo identities
- Demo POST: Return 201 with mock lead creation response

### 2. `app/api/crm/contacts/route.ts`
- Add `demoModeEnabled()` check  
- Demo GET: Return mock contacts array
- Demo POST: Return 201 with mock contact creation

### 3. `app/api/crm/deals/route.ts`
- Add `demoModeEnabled()` check
- Demo GET: Return mock deals array
- Demo POST: Return 201 with mock deal creation

### 4. `app/api/crm/pipelines/route.ts`
- Add `demoModeEnabled()` check
- Demo GET: Return mock pipelines array
- Demo POST: Return 201 with mock pipeline creation

### 5. `app/api/crm/contacts/import/route.ts`
- Add `demoModeEnabled()` check
- Demo: Return `needsMapping: true` with demo headers or success summary

### 6. `app/api/growth/leads/route.ts`
- Add `demoModeEnabled()` check
- Demo POST: Return success with mock lead data

### 7. `app/api/growth/leads/[id]/status/route.ts`
- Add `demoModeEnabled()` check
- Demo PUT: Return updated lead status mock

### 8. `app/api/growth/analytics/route.ts`
- Add `demoModeEnabled()` check
- Demo GET: Return mock analytics data

### 9. `app/reports/page.tsx`
- Add demo mode state
- When demo mode, use mock data instead of fetching from API

### 10. `app/crm/page.tsx` (and sub-pages)
- Add auth guard that allows demo mode bypass
- OR: Add demo fallback at page level

## Verification
After implementation, run the existing test suite:
- `src/tests/demo-mode.test.ts` - Should still pass
- `src/tests/publish-idor.test.ts` - Should still pass
- Manual test: Set `NODE_ENV=development` and `RX_DEMO_MODE=1`, call endpoints, verify:
  - Status 200 with `x-demo-mode: true` header
  - Response contains `_demo: true`
  - Demo data uses correct identities