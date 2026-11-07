# WhatsApp Official Test Configuration Audit

**File**: `src/tests/whatsapp-official.test.ts`

## Summary

The WhatsApp official test file is **well-configured and covers the correct scenarios**. All test cases are properly structured with appropriate mock data.

## Test Suites Coverage

### 1. `openbsp/client` (lines 6-101)
- ✅ `config null quando falta qualquer credencial` - Verifies config returns null when API key is missing
- ✅ `POST usa SEMPRE apikey + api-key (nunca Authorization Bearer)` - Validates correct header format: `apikey` and `api-key` headers, `Authorization` must be undefined
- ✅ `http_error propagado sem lançar` - Tests HTTP error propagation (401 GRSTP301) without throwing
- ✅ `network_error (fetch rejeita) nunca lança` - Tests network error handling when fetch rejects
- ✅ `fetchConnectedAddress casa linha pelo extra.verify_token` - Tests address selection using verify_token
- ✅ `mintOnboardingToken devolve popupUrl com id do token` - Tests onboarding token minting returns popupUrl

### 2. `dispatcher: tier 24h + gate template (gates 2 e 5)` (lines 103-206)
- ✅ `checkTier: janela velha zera o contador; 80% dispara nearLimit` - Validates tier window reset and nearLimit at 80%
- ✅ `template NÃO aprovado bloqueia envio com erro explícito` - Tests that non-approved template blocks send with explicit `template_not_approved` error
- ✅ `template APROVADO passa; categoria divergente bloqueia` - Tests template approval flow with category mismatch detection and tier limit exhaustion

### 3. `provider factory` (lines 208-225)
- ✅ `meta_direct reservado falha de forma explícita` - Tests meta_direct provider returns explicit error
- ✅ `factory escolhe por env (default openbsp)` - Tests provider selection defaults to openbsp, can switch to meta_direct

## Key Findings

### Mock Data Format
- All mocks use proper `jest.fn()` pattern with `mockResolvedValue`/`mockRejectedValue`
- Responses follow `{ ok: boolean, status: number, text: async () => string }` pattern
- Body JSON parsing is tested in relevant tests (e.g., lines 46-50, 96-99)

### Critical Validations
1. **Header format** (line 43-45): Tests confirm `apikey` and `api-key` headers are used, `Authorization` is **never** used (correct for OpenBSP)
2. **E.164 format** (line 47): Phone numbers stored without `+` prefix (`5511999998888`)
3. **Organization address** (line 49): `organization_address` comes from phoneNumberId parameter
4. **Content versioning** (line 50): `content` must have `version: '1'`, `type: 'text'`, `kind: 'text'`

### Test Data Structure
- `baseChannel()` helper (lines 104-122) provides complete channel state with:
  - `tierLimitPer24h: 250`, `sentWindow24h: 0`
  - `windowStartedAt` with ISO date
  - `accessTokenEnc: null`, `lastError: null`
- `fakeClient()` helper (lines 124-134) mocks Supabase-like client with `from()`, `select()`, `update()`, `upsert()`

## Issues Found: None

The test file is complete and correct. All scenarios are covered:
- Credential validation
- HTTP error handling
- Network error handling
- Template approval gates
- Tier/rate limiting
- Provider selection
- Address/token mapping

## Recommendation

✅ **No changes needed**. The test file is properly configured and covers all necessary integration scenarios for the WhatsApp official (019) implementation with OpenBSP.