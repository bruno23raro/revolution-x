# FASE 3 — Plano de credenciais (C-1) e RLS (C-2) — Rascunho aguardando GO

> Nada aqui foi executado. Este é o mapa cirúrgico, pronto para virar execução no seu
> comando. Segredos: NENHUM valor aqui; só nomes e localização (regra nova).

## Parte 1 — Giro de credenciais vazadas (C-1)

Ordem exata (janela ~2-3h, com janela de indisponibilidade curta apenas no passo 1):

| # | Credencial | Onde girar | Onde propagar | Quebra ao girar | Mitigação |
|---|---|---|---|---|---|
| 1 | Senha Postgres prod (`ardpabjoepzhkpmkgwgu`) | Supabase hPanel → Settings → Database → Reset | hPanel Hostinger env `DATABASE_URL`+`DIRECT_URL`; `.env.local`; supabase-docker (não usa a mesma) | app 500 por ~1min até redeploy | girar → propagar → restart Hostinger, em sequência |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase hPanel → API Keys (rotacionar) | env Hostinger + `.env.local` | webhooks/onboarding 500 | mesmo restart |
| 3 | `META_APP_SECRET` | Meta Developers → App → Settings → Basic → Reset | env Hostinger + `.env.local` | OAuth novo falha até propagar; webhooks assinados 401 até propagar | girar fora de horário; revalidar webhook |
| 4 | `META_TOKEN_ENCRYPTION_KEY` | gerar 64 hex novos | env Hostinger + `.env.local` | tokens OAuth gravados ficam ilegíveis | **CUSTO ZERO HOJE**: `meta_integrations`=0 e `integrations` sem tokens OAuth de clientes (confirmado 2026-11-06) — girar AGORA |
| 5 | `META_WEBHOOK_VERIFY_TOKEN` | gerar hex novo | env Hostinger + Meta Console → Webhooks → Edit callback | verificação GET 403 até atualizar Meta | fazer junto com 3 |
| 6 | Resend `EMAIL_API_KEY` | resend.com → API Keys → rotate | env Hostinger + `.env.local` **e** GoTrue hPanel → Auth → SMTP senha | e-mail transacional | testar register 201 + delivered depois |
| 7 | OpenBSP `OPENBSP_API_KEY` | dashboard OpenBSP → keys | env Hostinger + `.env.local` | onboarding OpenBSP | chave owner só é usada no mint |
| 8 | `CRON_SECRET`, `ADMIN_ALERT_TOKEN` | gerar novos | env Hostinger; cron Hostinger header; n8n WF-04 header | cron/Alerta-5xx | atualizar WF-04 junto |
| 9 | Tokens CAPI `META_CAPI_ACCESS_TOKEN` + `SYSTEM_USER_TOKEN` | Meta Business Manager | env Hostinger + `.env.local` | CAPI para de receber | retestar event firehose |
| 10 | `JWT_SECRET` (GoTrue local/prod) | Supabase hPanel → Auth config | — | sessões antigas caem (usuários re-logam) | aceitável com 0 clientes |
| 11 | Senhas locais docker (`supabase-docker/.env`) | gerar novos, recriar stack | local | stack dev | fora da crítica |

Depois de TODOS os giros:
- rodar `scripts/verify-rotacao.ps1` (a criar): smoke /, /api/auth/session 401, register 201,
  webhook meta GET challenge, openbsp mint, ai/generate.
- Repo privado (D-1) — PRÉ-requisito — e purga de histórico (filter-repo) no mesmo dia.

## Parte 2 — Reconstrução RLS (C-2)

Rascunho completo do DDL em `docs/auditoria/028_tenant_rls_DRAFT.sql`. Resumo do desenho
(espelha o padrão JÁ vivo em produção: `NULLIF(current_setting('app.current_org',true),'')::uuid`
que `src/lib/prisma.ts:27` e `taskQueue.ts:117` setam):

- **Grupo A (29 tabelas com "organizationId")**: ENABLE + FORCE RLS + policy
  `<t>_tenant` USING/WITH CHECK organization = GUC. Caso especial `Session` (org OU usuário).
- **Grupo B**: `meta_integrations` (snake_case `organization_id`).
- **Grupo C**: `EmailVerificationToken`/`PasswordResetToken` por `userId` (GUC user).
- **Grupo D**: `integration_events` só FORCE (já tem policies); `integrations` só FORCE
  (policy user_id existe); `webhook_events` (sem coluna de tenant) → policy
  service-only (current_user in service_role/postgres).
- **Grupo E (sem RLS por decisão)**: `User`, `Organization`, `Plan`, `Permission` — lidas
  antes do GUC existir (register/middleware). Ficarão em exceção documentada até T3.3.

Sequência de aplicação segura:
1. Aplicar no Postgres de teste (supabase-docker :15432) → rodar suíte `tests/rls.test.ts`
   adaptada + criar **suíte de autorização negativa** (tenant A vs B em cada rota de leitura).
2. Correr a suíte completa do app CONTRA o banco com RLS ligado — caça dependências
   silenciosas de service_role (esperado: nenhuma quebra, pois service_role tem BYPASSRLS;
   quem quebra é via anon/postgres direto — mapeado na auditoria: crmRepoReal usa BYPASSRLS
   direto, é papel `postgres` com bypass → ok).
3. Backup prévio da produção (pg_dump) + aplicar 028 no janelão → verificar:
   `select count(*) from pg_class where relnamespace='public::regnamespace' and relkind='r'
    and not relforcerowsecurity` = 0 exceto Grupo E.
4. Smoke produção: login, dashboard, crm/contacts, whatsapp send, webhook simulado.
5. (T3.3, depois) criar role `revx_app` sem BYPASSRLS e mover o Prisma para ela.

Riscos conhecidos mapeados:
- `crmRepoReal` (where manual + conexão BYPASSRLS): continua funcionando; RLS passa a valer
  quando T3.3 trocar a role.
- `AdminAlert` permite `organizationId IS NULL` (alertas de sistema) — manter.
- Cron/multi-tenant: `runTikTokCronForAll` roda via taskQueue que JÁ seta os GUCs por escopo.
- Webhooks (anon): rodam com service_role → imunes.

## O que preciso do seu GO para começar

- GO-3a: executar Parte 1 (giros) — exige cliques seus em Supabase/Meta/Resend/OpenBSP
  (posso fazer tudo via API onde houver PAT; Meta Business Manager é UI-only).
- GO-3b: aplicar 028 no banco de teste + escrever suíte negativa (100% automatizável por mim).
- GO-3c: aplicar 028 em produção depois do 3b verde (exige sua janela).
