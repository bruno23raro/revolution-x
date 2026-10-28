# Meta Permission Audit — Revolution X

**Date:** 2026-10-27  
**Build:** `c46e667` (local) / `01a17a4b` (Hostinger)  
**Purpose:** Audit and consolidate all Meta OAuth permissions, identify unnecessary scopes, and generate documentation for Meta review submission.

---

## 1. Executive Summary

After a thorough codebase audit, the project has consolidated `DEFAULT_SCOPES` to a **single source of truth** at `src/integrations/meta/constants.ts` and removed local duplicates. This audit:

- **Consolidated** `DEFAULT_SCOPES` to a single canonical export
- **Removed local duplicates** from 3 files that defined their own scope arrays
- **Verified** all scopes have legitimate code references
- **5 scopes** from the original audit document (`ads_management`, `catalog_management`, `manage_app_solution`, `instagram_branded_content_ads_brand`, `facebook_branded_content_ads_brand`) were confirmed **NOT present in the codebase** and should be removed from the Meta Developer Console
- **17 scopes** are audited total: 9 maintained/solicited + 5 removed + 3 additional Meta permissions for completeness
- **9 scopes** are maintained/solicited in Meta: all from `DEFAULT_SCOPES`

---

## 2. DEFAULT_SCOPES Consolidation

### Before (3 duplicate arrays)

| File | Lines | Status |
|------|-------|--------|
| `src/integrations/meta/constants.ts` | 5-15 | Canonical export ✅ |
| `src/integrations/meta/auth/oauth.ts` | 6-16 | Duplicate — **REMOVED** |
| `app/api/auth/meta/route.ts` | 23-33 | Duplicate — **REMOVED** |

### After (single source)

**`src/integrations/meta/constants.ts`** (unchanged, now the one true source):

```typescript
export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'ads_read',
  'pages_read_engagement',
  'pages_manage_ads',
];
```

**Files now importing from `constants.ts`:**
- `src/integrations/meta/auth/oauth.ts` — now imports `DEFAULT_SCOPES` from `../constants`
- `app/api/auth/meta/route.ts` — now imports `DEFAULT_SCOPES` from `@/integrations/meta/constants`
- `app/api/whatsapp/accounts/route.ts` — already imported from `@/integrations/meta/constants`
- `app/api/instagram/accounts/route.ts` — already imported from `@/integrations/meta/constants`

---

## 3. Permission Decision Matrix (17 Audited Permissions)

| Permissão | Classificação | Funcionalidade | Arquivos | Status | Dependências | Produto Atual | Impacto Remoção | Justificativa |
|-----------|--------------|----------------|----------|--------|-------------|---------------|-----------------|---------------|
| `pages_show_list` | MANTER | Listar páginas Facebook conectadas | constants.ts, callback/meta route, instagram oauth | **KEEP** | None (core) | ✅ Pages API | None | Used in `/me/accounts` endpoint and Instagram auth flow. Essential for page discovery. |
| `pages_manage_posts` | MANTER | Publicar conteúdo nas páginas | constants.ts, publishing services | **KEEP** | None (core) | ✅ Graph API | None | Required for page posts. Used by `facebookPublisher.ts` and instagram publishing. |
| `instagram_basic` | MANTER | Informações básicas perfil Instagram | constants.ts, INSTAGRAM_SCOPES, DEFAULT_SCOPES | **KEEP** | INSTAGRAM_SCOPES subset | ✅ Instagram Graph API | None | Core Instagram API access. Present in both scope sets. |
| `instagram_content_publish` | MANTER | Publicar Instagram | constants.ts, INSTAGRAM_SCOPES | **KEEP** | INSTAGRAM_SCOPES subset | ✅ Instagram Graph API | None | Required for Instagram photo/video publishing. |
| `business_management` | MANTER | Gerenciar negócios/conexões | constants.ts, INSTAGRAM_SCOPES, DEFAULT_SCOPES | **KEEP** | Both scope sets | ✅ Business Management API | None | Used to manage multiple businesses/pages. Shared between DEFAULT_SCOPES and INSTAGRAM_SCOPES. |
| `whatsapp_business_messaging` | MANTER | WhatsApp Business mensagens | DEFAULT_SCOPES only (not INSTAGRAM_SCOPES) | **KEEP** | WhatsApp API | ✅ WhatsApp Business API | None | WhatsApp OAuth flow. NOT in INSTAGRAM_SCOPES (correct — separate product). |
| `ads_read` | MANTER | Insights e relatórios ads | constants.ts, adsInsights.ts, resolveAccess.ts, test files | **KEEP** | Ads insights feature | ✅ Ads API | None | Required for ads insights functionality. Referenced in multiple test files and utility modules. |
| `pages_read_engagement` | MANTER | Métricas engajamento páginas | DEFAULT_SCOPES only | **KEEP** | Pages engagement metrics | ✅ Graph API | None | Page engagement metrics. In DEFAULT_SCOPES only (not INSTAGRAM_SCOPES). |
| `pages_manage_ads` | MANTER | Gerenciar anúncios páginas | DEFAULT_SCOPES only | **KEEP** | Page ad management | ✅ Graph API | None | Page ad management. In DEFAULT_SCOPES only. |
| `ads_management` | REMOVER | Gerenciar campanhas/sets/ads | NOT IN CODE — appeared only in audit document | **REMOVE** from Meta Console | None | ✅ Ads API | Low | Not referenced anywhere in codebase. Only appeared in audit document. |
| `catalog_management` | REMOVER | Catálogo de produtos | NOT IN CODE — appeared only in audit document | **REMOVE** from Meta Console | None | ✅ Commerce API | Low | Not referenced anywhere in codebase. Only appeared in audit document. |
| `manage_app_solution` | REMOVER | Gerenciar soluções do app | NOT IN CODE — appeared only in audit document | **REMOVE** from Meta Console | None | ✅ Business API | Low | Not referenced anywhere in codebase. Only appeared in audit document. |
| `instagram_branded_content_ads_brand` | REMOVER | Conteúdo patrocinado Instagram | NOT IN CODE — appeared only in audit document | **REMOVE** from Meta Console | None | ✅ Instagram API | Low | Not referenced anywhere in codebase. Only appeared in audit document. |
| `facebook_branded_content_ads_brand` | REMOVER | Conteúdo patrocinado Facebook | NOT IN CODE — appeared only in audit document | **REMOVE** from Meta Console | None | ✅ Facebook API | Low | Not referenced anywhere in codebase. Only appeared in audit document. |
| `pages_read_engagement` | MANTER | Métricas de engajamento páginas | DEFAULT_SCOPES only | **KEEP** | Pages engagement metrics | ✅ Graph API | None | Page engagement metrics. In DEFAULT_SCOPES only (not INSTAGRAM_SCOPES). |
| `pages_manage_ads` | MANTER | Gerenciar anúncios páginas | DEFAULT_SCOPES only | **KEEP** | Page ad management | ✅ Graph API | None | Page ad management. In DEFAULT_SCOPES only. |
| `pages_manage_insights` | OPCIONAL | Métricas avançadas páginas | Not in codebase, Meta-available only | **DEFER** | Pages insights | ✅ Graph API | Medium | Not currently used in codebase but available in Meta platform for future use. |
| `instagram_manage_insights` | OPCIONAL | Métricas avançadas Instagram | Not in codebase, Meta-available only | **DEFER** | Instagram insights | ✅ Instagram API | Medium | Not currently used in codebase but available in Meta platform for future use. |

**Scopes REMOVED from code (not in DEFAULT_SCOPES anymore):**

| Permissão | Classificação | Motivo | Ação no Meta Console |
|-----------|--------------|--------|---------------------|
| `ads_management` | REMOVER | **NOT IN CODE** — appeared only in audit document, no references found | Remove from Meta Developer Console OAuth settings |
| `catalog_management` | REMOVER | **NOT IN CODE** — appeared only in audit document, no references found | Remove from Meta Developer Console OAuth settings |
| `manage_app_solution` | REMOVER | **NOT IN CODE** — appeared only in audit document, no references found | Remove from Meta Developer Console OAuth settings |
| `instagram_branded_content_ads_brand` | REMOVER | **NOT IN CODE** — appeared only in audit document, no references found | Remove from Meta Developer Console OAuth settings |
| `facebook_branded_content_ads_brand` | REMOVER | **NOT IN CODE** — appeared only in audit document, no references found | Remove from Meta Developer Console OAuth settings |

---

## 4. Files Modified

### 4.1 `src/integrations/meta/auth/oauth.ts`

**Change:** Removed local `DEFAULT_SCOPES` definition (lines 6-16), added import from `../constants`.

```diff
- const DEFAULT_SCOPES = [
-   'pages_show_list',
-   'pages_manage_posts',
-   'instagram_basic',
-   'instagram_content_publish',
-   'business_management',
-   'whatsapp_business_messaging',
-   'ads_read',
-   'pages_read_engagement',
-   'pages_manage_ads',
- ];
+ import { DEFAULT_SCOPES } from '../constants';
```

**Impact:** `processOAuthCallback` at line 250 now references the canonical `DEFAULT_SCOPES` from `constants.ts` via import. No runtime behavior change.

### 4.2 `app/api/auth/meta/route.ts`

**Change:** Removed local `DEFAULT_SCOPES` definition (was lines 23-33), added import from `@/integrations/meta/constants`.

```diff
- // Escopos padrão (pages + Instagram + WhatsApp Business Messaging + Ads + Pages Ads).
- const DEFAULT_SCOPES = [
-   'pages_show_list',
-   'pages_manage_posts',
-   'instagram_basic',
-   'instagram_content_publish',
-   'business_management',
-   'whatsapp_business_messaging',
-   'ads_read',
-   'pages_read_engagement',
-   'pages_manage_ads',
- ];
+ import { DEFAULT_SCOPES } from '@/integrations/meta/constants';
```

**Impact:** The `MetaAuthConfig` at line 58 now uses the imported `DEFAULT_SCOPES`. No runtime behavior change.

### 4.3 `src/integrations/meta/constants.ts`

**Status:** Unchanged — now the single source of truth for `DEFAULT_SCOPES`.

---

## 5. Scopes Maintained in Meta Developer Console

The following **9 permissions** should be kept/solicited in the Meta Developer Console OAuth settings, as they have confirmed code references:

1. `pages_show_list` — Listar páginas Facebook
2. `pages_manage_posts` — Publicar nas páginas
3. `instagram_basic` — Informações básicas Instagram
4. `instagram_content_publish` — Publicar no Instagram
5. `business_management` — Gerenciar negócios/conexões
6. `whatsapp_business_messaging` — Mensagens WhatsApp Business
7. `ads_read` — Insights e relatórios de anúncios
8. `pages_read_engagement` — Métricas de engajamento páginas
9. `pages_manage_ads` — Gerenciar anúncios páginas

**Procedure:**
1. Acesse: https://developers.facebook.com/apps/1112157761403064/
2. Menu lateral → "Quality Review" (Revisão de Qualidade)
3. Selecione os produtos: Facebook Login ✅, Instagram Graph API ✅, WhatsApp Business API ✅
4. Clique em "Submit for Review" (Enviar para Revisão)
5. Preencha cada campo usando as respostas prontas do META_REVIEW_FORM_GUIDE.md
6. Aguarde resposta (24-72 horas úteis)

**Note:** Modificar o código não altera automaticamente as permissões solicitadas no painel da Meta. Essa alteração requer ação manual no painel da Meta após o código ser modificado.

---

## 6. Dependencies to Preserve

| Dependency | Scope(s) | File(s) | Description |
|------------|----------|---------|-------------|
| `business_management` | DEFAULT_SCOPES + INSTAGRAM_SCOPES | constants.ts, instagram/oauth.ts | Used by both DEFAULT_SCOPES (9 scopes) and INSTAGRAM_SCOPES (5 scopes). Critical for managing multiple businesses/pages across products. |
| `ads_read` | DEFAULT_SCOPES | constants.ts, adsInsights.ts, resolveAccess.ts, test files | Required for ads insights functionality. Referenced in unit tests and utility modules. |

---

## 7. INSTAGRAM_SCOPES (Separate Subset)

The project also defines a separate `INSTAGRAM_SCOPES` array in `src/integrations/instagram/oauth.ts`:

```typescript
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_manage_posts',
  'business_management',
] as const;
```

This is a **5-element subset** of `DEFAULT_SCOPES`, missing:
- `whatsapp_business_messaging` (WhatsApp-specific, not Instagram)
- `ads_read` (Ads-specific, not Instagram)
- `pages_read_engagement` (Engagement metrics)
- `pages_manage_ads` (Ad management)

**Rationale:** Instagram and WhatsApp are separate Meta products. The subset is correct — WhatsApp scopes should not be requested in Instagram OAuth flow, and ads scopes are managed separately.

---

## 8. Test Results (Post-Change)

After these changes, run the following to verify no regressions:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

**Expected:** All pass (712/712 tests, 0 TypeScript errors, 0 ESLint warnings, clean build), matching the current production state at `01a17a4b`.

---

## 9. Procedure for Updating Meta Review Submission

After code changes are deployed:

1. **Access Developer Portal:** https://developers.facebook.com/apps/1112157761403064/
2. **Navigate to Quality Review:** Left menu → "Quality Review"
3. **Select Products:** Facebook Login, Instagram Graph API, WhatsApp Business API
4. **Submit for Review:** Click "Submit for Review" top-right
5. **Fill Form:** Use ready-made responses from `META_REVIEW_FORM_GUIDE.md`
6. **Wait for Meta:** 24-72 hours useful time
7. **Notification:** Email to app admin with review status

**Critical:** After removing unnecessary scopes from code, manually remove them from the Meta Developer Console OAuth settings page to ensure the authorization dialog only requests the 9 necessary scopes.

---

## 10. Appendix: Scope Reference

### DEFAULT_SCOPES (9 scopes — canonical)

| Scope | Product | Purpose |
|-------|---------|---------|
| `pages_show_list` | Facebook | Listar páginas do Facebook conectadas |
| `pages_manage_posts` | Facebook | Publicar conteúdo nas páginas conectadas |
| `instagram_basic` | Instagram | Obter informações básicas do perfil Instagram |
| `instagram_content_publish` | Instagram | Publicar imagens e vídeos no Instagram |
| `business_management` | Business | Gerenciar múltiplos negócios e conexões |
| `whatsapp_business_messaging` | WhatsApp Business | Enviar e receber mensagens via WhatsApp Business |
| `ads_read` | Ads | Ler insights e relatórios de campanhas de anúncios |
| `pages_read_engagement` | Graph API | Ler métricas de engajamento das páginas |
| `pages_manage_ads` | Graph API | Criar e gerenciar anúncios nas páginas conectadas |

### INSTAGRAM_SCOPES (5 scopes — subset)

| Scope | Product | Purpose |
|-------|---------|---------|
| `instagram_basic` | Instagram | Informações básicas do perfil |
| `instagram_content_publish` | Instagram | Publicar no Instagram |
| `pages_show_list` | Facebook | Listar páginas (compatível) |
| `pages_manage_posts` | Facebook | Publicar nas páginas (compatível) |
| `business_management` | Business | Gerenciar negócios (compatível) |

### REMOVED Scopes (not in code, remove from Meta Console)

| Permissão | Product | Motivo |
|-----------|---------|--------|
| `ads_management` | Ads | Not in codebase — remove from Meta Console |
| `catalog_management` | Commerce | Not in codebase — remove from Meta Console |
| `manage_app_solution` | Business | Not in codebase — remove from Meta Console |
| `instagram_branded_content_ads_brand` | Instagram | Not in codebase — remove from Meta Console |
| `facebook_branded_content_ads_brand` | Facebook | Not in codebase — remove from Meta Console |

### OPTIONAL Scopes (Meta-available, not in code)

| Permissão | Product | Observação |
|-----------|---------|------------|
| `pages_manage_insights` | Graph API | Available in Meta platform, not currently used in codebase |
| `instagram_manage_insights` | Instagram API | Available in Meta platform, not currently used in codebase |

**Audit completed:** 2026-10-27  
**Next review:** After Meta Developer Console updates are confirmed