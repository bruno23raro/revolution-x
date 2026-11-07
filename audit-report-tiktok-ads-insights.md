# TikTok Ads Insights Route Audit Report

**File:** `app/api/tiktok/ads-insights/route.ts`

## Summary

The TikTok ads insights route is **correctly configured** and follows the expected patterns for the TikTok Business API (BAP) integration. No issues were found.

## What Was Verified

### Route Structure ✅
- Accepts `GET /api/tiktok/ads-insights?date=YYYY-MM-DD&entity=AD_GROUP`
- Date validation via `isValidTikTokAdsDate` — rejects invalid formats, defaults to 'yesterday'
- Entity validation against `TIKTOK_ADS_ENTITIES` enum

### Configuration Resolution ✅
- Calls `resolveTenantTikTokAdsAccess(prisma, scope)` from `src/integrations/tiktok/resolveAccess.ts`
- Checks AgentMemory for key `integration:tiktok_ads` (via `providerConfigKey('tiktok_ads')`)
- Validates presence of `accessToken` (BAP token) and `advertiserId`
- Returns 409 when not configured, 503 when memory queue unavailable

### API Call Format ✅
- Calls `getTikTokAdsInsights(resolved.access, { date, entity })` from `src/integrations/tiktok/adsAnalytics.ts`
- Constructs request to `https://business-api.tiktok.com/open_api/v1.3/report/object/get/`
- Parameters: `advertiser_id`, `entity`, `date`, `time_grain=DAILY`, `metrics`, `order_by=show`, `order=DESC`
- Uses `Authorization: Bearer ${accessToken}` header
- Properly maps API error codes: `NoError` → ok, any other code → `http_error` (502)

### Error Handling ✅
- 400 for invalid date/entity parameters
- 409 for missing configuration (not_connected, no_token, no_advertiser)
- 503 for memory/queue unavailable
- 502 for TikTok API errors/network failures
- Detailed error messages in response body

### Dynamic Route ✅
- `export const dynamic = 'force-dynamic'` ensures the route is not cached

## Files Referenced

| File | Purpose |
|------|---------|
| `app/api/tiktok/ads-insights/route.ts` | Route handler (audited) |
| `src/integrations/tiktok/adsAnalytics.ts` | `getTikTokAdsInsights()` function, `TikTokAdsAccess` type |
| `src/integrations/tiktok/resolveAccess.ts` | `resolveTenantTikTokAdsAccess()` function |
| `src/integrations/configStore.ts` | `providerConfigKey()` — generates `integration:${provider}` key |
| `src/integrations/providers.ts` | Provider definition for `tiktok_ads` |

## Conclusion

The route is fully functional and correctly configured. The credential format (`accessToken` + `advertiserId`) stored under AgentMemory key `integration:tiktok_ads` matches the expected pattern. No edits are needed.