# Migração 021 — Integrações MANUAL (sem API) + multi-conta

**Data:** 2026-10-30 · **Arquivo:** `supabase/migrations/021_integrations_mode.sql` · **Risco:** baixo (aditivo, idempotente)

## O que muda no banco

A tabela `integrations` (criada na **018**) **já era multi-conta**: a UNIQUE
`(user_id, channel, meta_account_id)` permite N contas do mesmo canal por usuário.
Por isso **não** foi criada tabela nova `SocialAccount` — seria duplicar o que já existe.
A 021 só acrescenta a dimensão que faltava:

| Alteração | Detalhe |
|---|---|
| `integrations.mode TEXT NOT NULL DEFAULT 'OFFICIAL'` | `OFFICIAL` = OAuth da plataforma · `MANUAL` = sessão/cookie/token salvo manualmente |
| CHECK `integrations_mode_check` | `mode IN ('OFFICIAL','MANUAL')` |
| Índice `idx_integrations_user_mode` | `(user_id, mode)` — sustenta o filtro "API Oficial \| Sem API" |

RLS, concessões e demais colunas da 018 ficam intactos. `DEFAULT 'OFFICIAL'` faz toda
linha existente virar OFFICIAL automaticamente — nenhum backfill necessário.

A credencial manual (cookie de sessão / storageState / access token colado) é cifrada com
**AES-256-GCM** (`src/lib/encryption.ts`) e gravada em `integrations.access_token`, a mesma
coluna usada pelo OAuth. Nada de credencial em texto puro.

## Como aplicar

### 1. Banco local (self-hosted docker) — JÁ APLICADO
```powershell
docker cp supabase\migrations\021_integrations_mode.sql supabase-db:/tmp/021.sql
docker exec supabase-db sh -c "psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/021.sql"
```
Saída obtida: `ALTER TABLE` → `DO` → `CREATE INDEX` → `COMMENT`. Coluna `mode` confirmada
em `information_schema.columns`.

### 2. Supabase de produção
Pelo SQL Editor do painel (cole o conteúdo do arquivo inteiro, é uma transação segura e
repetível), **ou** pelo CLI:
```powershell
supabase db push
```
Verificação:
```sql
select mode, count(*) from integrations group by mode;
-- esperado: apenas OFFICIAL ate que alguem conecte uma conta manual
```

### 3. DB de teste `revolution-x-test-db-1` (:15432) — NÃO aplicar
Esse container não tem a tabela `integrations` (a cadeia dele não inclui a 018).
Aplicar a 021 isolada falha com `relation "integrations" does not exist`. Aplique primeiro
`018_*` e depois a 021, ou use o stack `supabase-db`.

## API nova

| Rota | Método | Corpo | Resposta |
|---|---|---|---|
| `/api/integrations/manual` | GET | — | `{ accounts, limits: { whatsapp: { used, max: 5 } } }` |
| `/api/integrations/manual/connect` | POST | `{ channel, credential, kind?, label? }` **ou** `{ channel, identifier, password, label? }` | `{ connected, id, status, metaAccountId, mode:'MANUAL' }` |
| `/api/integrations/manual/verify` | POST | `{ integrationId }` | `{ valid, status, reason?, detail? }` |

Rotas existentes alteradas:
- `GET /api/integrations/status` → cada item ganhou `mode` e `label`.
- `POST /api/integrations/disconnect` → `MANUAL` sofre **DELETE** (não há token a revogar na
  plataforma; a sessão cifrada não pode permanecer no banco). `OFFICIAL` mantém o soft-delete
  + revogação opcional na Graph API.

`meta_account_id` de conta manual é sintético e único por conexão
(`man-<canal4>-<uuid8>`), o que garante o multi-conta pela UNIQUE da 018.

## Frontend

- `app/integracoes/page.tsx` — toggle **Ver: API Oficial | Ver: Sem API**, contas listadas por
  card com botão **Remover Conta** (com modal de confirmação).
- `ManualAccountsCard` — canal (Instagram/Facebook/WhatsApp) × método (Email/Senha ou
  Token/Cookie). WhatsApp força cookie/token e mostra `usado/5`.
- `WhatsAppApiCard`, `InstagramCard`, `FacebookPagesCard`, `WhatsAppOfficialCard` — agora
  aceitam `accounts` + `onRemoveAccount`.
- `src/hooks/useIntegrationAccounts.ts` — fonte única de contas (nunca retorna tokens).

## Limite de 5 canais WhatsApp

Aplicado no servidor em `connectManualAccount` → HTTP **409** `limit_exceeded`.
No front, `WHATSAPP_MANUAL_MAX = 5` espelha o valor do servidor (shortcut anotado no código;
mover para o payload do `/status` se o limite virar configurável).

## Verificação honesta da credencial

`verifyManualCredential`:
- token Instagram/Facebook → sonda `GET graph.facebook.com/v26.0/debug_token` com o app token
  (`META_APP_ID|META_APP_SECRET`). `is_valid` → status `CONNECTED`.
- cookie de sessão e WhatsApp → **sem endpoint de validação** → status `PENDING` com
  `verify_unavailable`. A UI diz "salvo — clique em Verificar quando possível" em vez de
  fingir que validou.
- rede falhou → `PENDING` (nunca marca inválido sem certeza).

## Gates rodados (2026-10-30)

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 erros |
| `npx jest` | **754/754** em 56 suítes (novo: `src/integrations/manual.test.ts`, 5 casos) |
| `npx next lint` | 0 erros (2 avisos pré-existentes, não relacionados) |
| `npx next build` | OK, 74 rotas (`/api/integrations/manual*` presentes) |
| migration 021 | aplicada e verificada no `supabase-db` local |

## Pendências / riscos

1. **021 ainda NÃO aplicada em produção** — sem ela, `mode` não existe e `GET /status`
   retorna 500. Ordem: 018 → 021.
2. Login headless (Email/Senha) depende de Playwright/chromium no runtime do hPanel. Onde o
   browser não existir, o caminho de cookie/token colado continua funcionando.
3. Método MANUAL viola os ToS das plataformas (risco de bloqueio/banimento). O card avisa e
   toda conexão é registrada no auditor de risco (`logRisk` / `logRiskEntry`).
4. Verificação de cookie é `PENDING` por natureza — não há como validar sessão de WhatsApp Web
   por HTTP. Só vira `CONNECTED` com um gateway que exponha estado de conexão (EVO/Baileys).
