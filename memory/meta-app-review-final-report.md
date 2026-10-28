# Meta App Review — Status 2026-10-28

## Executado e APROVADO

| Gate | Resultado | Chamadas | Erro |
|------|-----------|----------|------|
| Marketing API Access Tier | APROVADO | 500/500 | 0% |
| Manage App Solution | APROVADO | 4/4 endpoints | 0% |
| WhatsApp number registration | ✅ CONCLUÍDO | WABA 801885496316680, Phone 1244329368771764 (+55 11 91734-5249) | — |

## Pendente — Ação Humana (Meta Developer Console)

### 1. Remover 8 scopes desnecessários do console da Meta
No painel `https://developers.facebook.com/apps/1112157761403064/` > Use Cases > "Criar e gerenciar anúncios" > Permissões e recursos, remover via "Ações" > "Remover":
- `ads_management` (C — confirmado: não há código)
- `catalog_management` (C — ausente do codebase)
- `instagram_branded_content_ads_brand` (C — ausente do codebase)
- `facebook_branded_content_ads_brand` (C — ausente do codebase)
- `pages_manage_metadata` (C — ausente do codebase)
- `ads_mcp_management` (C — ausente do codebase)
- `pages_messaging` (C — ausente do codebase)
- `whatsapp_business_manage_events` (pendente verificação — confirmar se webhook usa)

### 2. Submeter Facebook Login para review
- App Review > Permissions and Features
- Confirmar 11 scopes: `whatsapp_business_messaging`, `business_management`, `ads_read`, `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_ads`, `pages_read_user_content`, `whatsapp_business_management`
- Preencher formulário com justificativas (META_REVIEW_FORM_GUIDE.md)
- Anexar vídeos (screencasts) se disponíveis

### 3. Aguardar 24-72h úteis pela resposta da Meta

## ✅ Concluído Nesta Sessão

### Fix: DEFAULT_SCOPES em `src/integrations/meta/constants.ts`
**ANTES (8 scopes — faltavam 3 obrigatórios):**
```typescript
export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'pages_read_user_content',
  'whatsapp_business_management',
];
```

**DEPOIS (11 scopes — todos 9 mantidos + dependências):**
```typescript
export const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
  'pages_read_user_content',
  'whatsapp_business_management',
  'ads_read',
  'pages_read_engagement',
  'pages_manage_ads',
];
```
- **Adicionados:** `ads_read` (Level A — Ads Insights), `pages_read_engagement` (Level B — dependência de `business_management`), `pages_manage_ads` (Level B — dependência de `business_management`)

### Validação Completa
- **Build**: ✅ Next.js 14.2.35 — 65 rotas, sem erros
- **TypeScript**: ✅ 0 erros
- **ESLint**: ✅ 0 warnings
- **Testes**: ✅ 712/712 PASS
- **Migrations**: 10 aplicadas (005–017)
- **FORCE RLS**: 21 tabelas

## Artefatos Gerados
- `artifacts/RX_META_APP_REVIEW_20261027_HHMM.zip` (36,992 bytes)
- `artifacts/RX_META_APP_REVIEW/00_LEIA_PRIMEIRO.md`
- `artifacts/RX_META_APP_REVIEW/01_DOCS/` — 13 docs de permissões
- `artifacts/RX_META_APP_REVIEW/02_VIDEOS/_raw/RX_VID_unknown_20261027.webm`
- `artifacts/RX_META_APP_REVIEW/03_EVIDENCIAS/` — 10 screenshots
- `artifacts/RX_META_APP_REVIEW/04_APP_LEVEL/` — app-level approval docs
- `artifacts/RX_META_APP_REVIEW/05_TRACKING/RX_CSV_SUBMISSION_TRACKER_20261027.csv`
- `artifacts/RX_META_APP_REVIEW/06_CONSOLE/` — console log template

## Status do Projeto (2026-10-28)

- **Testes**: 712/712 PASS
- **TypeScript**: 0 erros
- **ESLint**: 0 warnings (scripts/meta/*.js corrigidos)
- **Build**: limpo
- **Migrations**: 10 aplicadas (005–017)
- **FORCE RLS**: 21 tabelas
- **Site**: https://revolutionx.com.br (Hostinger, build 01a17a4b)
- **Webhook Meta**: verificado (GET→200, POST unsigned→401)
- **CLI Tools**: Vercel 65.5.0, Supabase, Playwright 1.64.1 instalados globalmente
- **Marketing API 500 calls**: 0% error — APROVADO
- **Manage App Solution**: 4/4 endpoints — APROVADO

## Próximos Passos (Autônomos, se possível)
1. **Ação humana**: Remover 8 scopes desnecessários no console Meta (Use Cases > "Criar e gerenciar anúncios" > Permissões e recursos)
2. **Ação humana**: Submeter Facebook Login para review com 11 scopes corretos
3. Aguardar aprovação do Facebook Login (externo, 24-72h)
4. After approval: testar OAuth flow completo com novo user
5. Configurar DMARC p=reject após confirmar delivery
6. Configurar MCP servers: meta, meta_social_technologies, supabase, hostinger, vercel, github
7. Gravar screencasts Round 1 (7 Level A + 1 Level B) se necessário