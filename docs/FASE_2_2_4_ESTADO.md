# FASE 2.2.4 — Estado do Projeto

**Data:** 2026-11-11
**Objetivo:** Recuperação de build e segurança crítica (templates WhatsApp, RBAC/RLS, webhook Meta).

---

## Resumo executivo

| Gate | Resultado | Evidência |
|---|---|---|
| Jest (suíte completa) | ✅ **1074/1074** | `npx jest` — 76 suítes, 0 falhas |
| TypeScript (`tsc --noEmit`) | ✅ **0 erros** | após limpar `tsconfig.tsbuildinfo` (cache incremental stale) |
| Build Next.js | ✅ **91 páginas** | `npx next build` — compiled successfully, 91 static |
| Lint (`next lint`) | ✅ limpo | 1 warning pré-existente (react-hooks/exhaustive-deps em TemplatePreview.tsx) |

---

## Escopo executado

Prioridades do contrato (id="a3c8"):

### P1 — Restaurar `getWhatsAppTemplate` e `sendTestMessage`
Restaurados em `src/integrations/meta/whatsappTemplates.ts` (contrato v19.0):
- `getWhatsAppTemplate` — busca template individual via `GET /{scope}/message/templates/{id}`.
- `sendTestMessage` — envia template de teste via `POST /{phoneNumberId}/messages` (tipo `template`), com suporte a variáveis e idioma customizado.
- `getTemplateStatus` — resumo status+quality_score delegando a `getWhatsAppTemplate`.

### P2 — Recuperar o build
Build verde após correções de tipos e remoção de arquivo de teste morto não-rastreado (`TemplatePreview.test.tsx`, que referenciava `@testing-library/react`/jest-dom não instalados e não é coberto pelo `testMatch` do jest — `**/*.test.ts`).

### P3 — Investigar suítes que falhavam (análise transitiva)
Suítes corrigidas nesta fase (causa raiz identificada — ver `FASE_2_2_4_CORRECOES.md`):
- `processTemplateWebhook` — caractere corrompido em type annotation.
- `whatsapp-templates-api` — mock stale (`templateName`→`name`), falta de validação de nome, testes de rota consolidada.
- `whatsapp-templates/route.test.ts` — assertiva de nome inválido obsoleta.
- `publish-idor` — corrupção estrutural (`});` spúrio) + guard de demo mode + mock de `resolveAccess`.
- `webhooks/meta` — claim de idempotência movido para dentro do `withTenantContext` (tx), alinhando com o contrato do teste e melhorando isolamento RLS.
- `fase1-routes` — assertiva de refresh-token agora verifica repasse correto das credenciais do env.

### P4 — Preservar e revalidar o fix RBAC
Suítes `require-role` + `admin-routes` verdes (118/118). Nenhuma regressão no `requireRole`/`requireOwner`/`isOwnerEmail`.

### P5 — Auditoria RLS/PostgreSQL
- Claim de idempotência do webhook agora roda **dentro** do contexto de tenant (`withTenantContext`), tornando a escrita em `webhook_events` escopada por organização — melhoria de isolamento real.
- Degradação honesta preservada: se o claim lança (índice 015 ausente), processa mesmo assim, nunca perde evento.

---

## Estado de git

Branch `main` — muitas alterações não-commitadas do turno (build recovery + segurança). Nenhum deploy/commit/push realizado (aguardam autorização explícita).

---

## Bloqueios / pendências
- Nenhum deploy, commit ou push sem autorização explícita do projeto.
- Nenhuma migration de produção executada — mudanças são de código e teste apenas.
- `TemplatePreview.test.tsx` removido por ser morto/não-rastreado; se houver intenção de testar `TemplatePreview`, reinstalar `@testing-library/react` + `@testing-library/jest-dom` e recriar com o matcher `testMatch` adequado.

---

## Estado de git

Branch: `main` — muitas mudanças não-commitadas do turno (build recovery, security). Nenhum deploy/push realizado (aguarda autorização).

---

## Bloqueios / pendências
- Nenhum deploy, commit ou push sem autorização explícita (regra do projeto).
- Nenhuma migration de produção executada — mudanças são de código e teste apenas.
- `TemplatePreview.test.tsx` removido por ser morto/não-rastreado; se houver a intenção de testar `TemplatePreview`, reinstalar `@testing-library/react` + `@testing-library/jest-dom` e recriar com o matcher `testMatch` adequado.