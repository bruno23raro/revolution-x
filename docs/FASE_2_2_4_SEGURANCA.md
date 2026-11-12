# FASE 2.2.4 — Segurança

**Data:** 2026-11-11

Auditoria de segurança e hardening aplicados nesta fase. Nenhuma permissão foi enfraquecida; a "REGRA ABSOLUTA" (nunca fechar porta aberta; construir/testar/validar antes de substituir) foi respeitada.

---

## 1. RBAC — revalidação (P4)

- `requireRole`, `requireOwner`, `getTargetOrganization`, `requireMembershipIn`, `isOwnerEmail` — revalidados sem regressão.
- Suítes `require-role` + `admin-routes`: **118/118**.
- Nenhuma rota de admin teve o guard de função removido ou reduzido.

## 2. IDOR / escalonamento cross-tenant — hardening (P5)

- **Publish de conteúdo** (`/api/facebook/publish`, `/api/instagram/publish`):
  - Adicionado guard de **demo mode** **antes** da resolução de tenant: `demoModeEnabled() && user.id === DEMO_IDENTITIES.USER_ID`.
  - Isso impede que um usuário não-autenticado force `organizationId`/`account` no body para ler ou publicar em dados de outra organização. Só a identidade demo pinada recebe resposta simulada; usuários reais jamais recebem simulação.
  - Suíte `publish-idor` (7/7) cobre: 401 sem usuário, demo 200 com header `x-demo-mode`, e não-exposição de dados quando `account` é forçado.

## 3. Webhook Meta — idempotência e isolamento de tenant

- **Antes:** o claim atômico rodava em `prisma.$queryRaw` (módulo, fora do contexto de organização) — a escrita em `webhook_events` não ficava escopada por RLS.
- **Depois:** o claim (`INSERT ... ON CONFLICT (meta_event_id) DO NOTHING RETURNING`) roda **dentro** de `withTenantContext` via `tx.$queryRaw`, escopando a escrita por organização. Isso é estritamente mais correto para isolamento multi-tenant.
- **Degradação honesta preservada:** se o claim lança (índice 015 ausente / infra), processa mesmo assim e devolve 200 `accepted` — nunca perde evento. Suíte 10/10.

## 4. Assinatura HMAC do webhook (não alterado, revalidado)

- `X-Hub-Signature-256` validada com `crypto.timingSafeEqual`; sem assinatura ou sem `META_APP_SECRET` → 401. Revalidado nas suítes.

## 5. Segredos — nenhuma exposição nova

- Nenhum segredo hardcoded adicionado. Credenciais vivem em `.env.local` (`.gitignore`).
- A correção do teste de refresh-token **nunca asserta o valor do secret** — apenas verifica que a rota repassa o env (`process.env.META_APP_SECRET ?? ''`).

## 6. Não alterado / sem efeito

- **RLS FORCE** nas tabelas: intocado (aplica-se ao schema de produção, não a estas mudanças de código/teste).
- **Pooling de conexão / fail-closed**: nenhuma mudança de infra; as rotas mantêm fail-closed (401/409/502 em vez de vazar dados).
- **Nenhuma migration de produção, deploy, rota remota ou rotação de credencial** foi executada — requerem autorização explícita.

---

## Postura

Nenhuma correção desta fase reduziu proteção. As mudanças de segurança foram:
1. **Adicionar** guard de demo mode (novo controle).
2. **Endurecer** o claim de idempotência para dentro do contexto de tenant (isolamento RLS).
3. **Preservar** degradação honesta e fail-closed existentes.

Todo o restante foi recuperação de build/teste com causa-raiz documentada em `FASE_2_2_4_CORRECOES.md`.