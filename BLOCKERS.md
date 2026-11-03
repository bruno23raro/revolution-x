# Protocol P0.8 Blockers — atualizado 2026-11-03

## ✅ RESOLVIDO: n8n WF-04 severity (H-4) — 2026-11-03

- **Evidência**: execução #75 do workflow `rxWf000000000004` → **success**
- **Fix**: severity dinâmica no node `send_whatsapp_critical` — `"severity": "={{ $json.severity }}"` no jsonBody (antes ficava hardcoded/ausente e caía no default `warning` do endpoint)
- **Enrich Alert** (function node): `severity: alert.severity || (alert.statusCode >= 500 ? 'critical' : 'warning')`
- **Confirmação de ponta a ponta**: payload crítico postado no webhook `/webhook/alerta-5xx` → `POST /api/admin/notify-whatsapp` com Bearer `ADMIN_ALERT_TOKEN` → **AdminAlert persistido** no banco com severity correta
- **Docs**: `docs/N8N.md` (antes/depois, tabela de workflows, endpoints confirmados)
- **Ação restante**: nenhuma — item fechado

## ✅ RESOLVIDO: Multi-conta Meta por organização (H-1 técnico) — 2026-11-03

- **Escopo**: Permitir múltiplas contas do MESMO provedor Meta (WhatsApp, Facebook, Instagram) por tenant (ex.: várias Páginas, vários números WhatsApp)
- **Status técnico**: ✅ COMPLETO — código, testes, migração 016 (validada em banco descartável)
- **O que foi implementado**:
  - **Resolver determinístico** (`resolveTenantMetaAccess`, `resolveTenantPublisherAccess`, `resolveTenantFacebookPageAccess`, `resolveTenantMetaAdsAccess`): seleção por `connected_at desc` + ancoragem por `accountId` (row id) — elimina ordem arbitrária do `.limit(1)` antigo
  - **Seletor de contas na UI** (`/api/integrations/meta` GET → lista multicontas; `/api/whatsapp/accounts` → rótulo com `display_name` da migration 016; fallback gracioso sem a coluna)
  - **IDOR remediation**: rotas usam `user.organizationId` do banco + RLS (anon key), nunca `service_role` em rotas autenticadas; `accountId` passado explicitamente no body
  - **Refresh de token por conta** (`/api/integrations/meta/refresh-token`): aceita `account` (row id) para renovar a conta específica; ausente → conta padrão
  - **Campanhas com seleção por conta** (`/api/campaigns` + UI): `accountId` ancorado na criação e no disparo; resolver honra o id
  - **Migração 016** (`supabase/migrations/016_multi_meta_accounts.sql`):
    - Adiciona `display_name` (rótulo p/ UI)
    - Remove `UNIQUE(organization_id, provider)` — permite múltiplas linhas do mesmo provedor
    - Adiciona `uq_meta_integrations_account` (expressão: organization_id, provider, coalesce(meta_page_id, phone_number_id, instagram_account_id)) — evita duplicata exata da mesma conta
    - Adiciona `uq_meta_integrations_page` (organization_id, provider, meta_page_id) — suporte ao upsert por página no callback OAuth
  - **Testes**: `meta-resolver-multi.test.ts` (15 testes — seleção determinística, ancoragem, `account_not_found`), `meta-idor.test.ts` (5 testes — IDOR negativo), `whatsapp-accounts-route.test.ts` (UI listagem), `campaigns-routes.test.ts` (integração campanhas) — **70 testes PASS**
- **Pré-requisito pendente**: Aplicar migration 016 no Supabase **produção** (passo humano — DDL em produção requer autorização). Sem 016, a 2ª+ conta do mesmo provedor falha com erro de constraint UNIQUE (documentado e testado).
- **Ação restante**: Aplicar 016 em produção quando autorizado.

## Real Blockers (require human action or MCP workaround)

### BLOCKER: n8n REST API 401
- **Status**: Documented as real blocker, contornado por MCP cloud
- **Evidence**: 25+ authentication method variations tested, all return 401
- **Key details**:
  - n8n Docker container `rx-n8n` (v1.100.0) running and healthy
  - `X-N8N-API-KEY` header name confirmed correct (error: `"'X-N8N-API-KEY' header required"`)
  - N8N_API_KEY value from `.env.local` line 49 (mascarado — valor puro só no env)
  - Basic auth ativa (usuário/senha do container, mascarados) mas também rejeitada
  - Git commit `27d7a16` hints at "Bearer prefixo duplicado do n8n" — prefix configuration issue
  - Key format: 32-char alphanumeric string (NOT JWT: has 1 part, not 3)
- **Workaround**: Use MCP cloud (`claude mcp list` → n8n-mcp connected) instead of local REST API
- **Resolution path**: Document as blocker, execute workflows via MCP cloud, mark local REST as out of scope

### BLOCKER: Meta System User Token (H-1)
- Requires Business Manager UI interaction — [HUMANO]
- Account 1421814643397349: rollout pending
- Alternative app 1112157761403064: uncertain flow status
- Steps prontos em `docs/H_BLOQUEIO.md`; auditoria técnica da integração Meta em andamento (P1)

### BLOCKER: Facebook Login Review (H-2)
- Remove unnecessary scopes, submit in Meta Console — [HUMANO]
- Auditoria de scopes em andamento (P3); evidências e instruções serão preparadas antes da submissão

### BLOCKER: GoTrue SMTP (H-3)
- **RESOLVIDO 2026-10-29**: SMTP configurado no Supabase hPanel (produção `ardpabjoepzhkpmkgwgu`). Registro produção retorna 201 e email de confirmação entregue (19:02:15Z). `.env.local` continua apontando para Supabase LOCAL (não afeta produção). Evidência em `artifacts/RX_INTEGRATIONS_FINAL_REPORT.md` passo 2.

### BLOCKER: AdminAlert Cleanup
- 3 rows with organization_id=null — `delete from admin_alerts where organization_id is null`

### BLOCKER: Scope Cleanup
- Meta Console requires withdraw of unnecessary scopes before submission (ver auditoria P3 para a lista final confirmada em código)

## Contornado por MCP Cloud ✅

### n8n Cloud (MCP)
- `claude mcp list` → n8n-mcp conectado
- Listar tools; chamar uma tool de leitura e obter dado
- Se voltar dado, esse é o caminho daqui pra frente
- Workflows: WF-03, WF-04, WF-05 executar pela via cloud

### Meta Graph API (partial)
- App Access Token: 200 OK
- /roles: 200 OK (2 admins)
- Ad Account: 403 Forbidden (app token lacks access) — requires system user token
- /me: 400 (expected — app token limitation)

### Chrome CDP
- Chrome 154 at 127.0.0.1:9222, 23 tabs accessible
- Ready for browser automation via CDP
