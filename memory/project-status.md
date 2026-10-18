---
name: project-status
description: "Revolution X state 2026-10-18: main @ 3a4d457 + FASE 1 (Hub de Integrações + WhatsApp) em construção local — serviços/rotas/testes verdes (283 testes, tsc 0, build ok)"
metadata:
  node_type: memory
  type: project
  originSessionId: 919bbc50-9736-4cea-8477-4be5f6ce2cb6
  modified: 2026-10-18T12:00:00.000Z
---

# Revolution X — Project Status (2026-10-18, ~12:00)

## Git Status
- `main @ 3a4d457` (194/194 na base; chat admin seguro via DB, sem OmniRouter obrigatório).
- **FASE 1 (esta sessão) ainda NÃO commitada**: serviços + rotas + testes do Hub de
  Integrações e do WhatsApp, todos verdes localmente. Ver "O que foi feito" abaixo.

## Build & Test Status (local, pós-FASE 1)
- jest **283/283 PASS** (21 suítes; +47 serviços FASE 1 e +42 rotas FASE 1).
- `tsc --noEmit` **0 erros**.
- `next build` **verde** — as 7 rotas novas empacotadas como `ƒ` (dynamic).

## O que foi feito nesta sessão (FASE 1 — destravar o quase-pronto)
### Serviços (src/integrations/*)
- `configStore.ts` — config de provedores/chatbot/templates em `AgentMemory` (RLS), padrão ai-config.
- `providers.ts` — registry oficial vs "Sem API/Avançado" + health probes honestos (`probeProvider`/`probeMany`).
- `meta/whatsappSender.ts` — Cloud API: texto, template, **mass-send** (`runMassSend`, nunca lança).
- `meta/whatsappTemplates.ts` — listar/criar templates oficiais.
- `meta/whatsappChatbot.ts` — motor de regras puro e injetável (greeting/regras/IA/fallback/horário).
- `meta/tokenRefresh.ts` — troca de token via `fb_exchange_token` (erros honestos).
- `meta/resolveAccess.ts` — lê `meta_integrations` (snake_case, service_role) + `decryptToken` → acesso pronto.
- `connectors/whatsapp.ts` — **reescrito** para delegar ao sender (era stub BLOQUEADO).

### Rotas (app/api/*)
- `/api/integrations/config` GET/POST/DELETE (segredos só no banco; GET nunca devolve segredo).
- `/api/integrations/health` GET (health probes por provedor).
- `/api/integrations/meta/refresh-token` POST (troca + re-criptografa + persiste via service_role).
- `/api/whatsapp/send` POST (mass-send; fila é melhor esforço — o envio nunca é bloqueado).
- `/api/whatsapp/templates` GET (listar+snapshot) / POST (criar, admin).
- `/api/whatsapp/chatbot` GET/POST/DELETE (admin; config em AgentMemory).
- `/api/webhooks/inbound` POST (n8n/Zapier/Make; **secret compartilhado fail-closed**; grava `webhook_events` melhor esforço).

### Testes
- `src/tests/fase1-chatbot-sender.test.ts`, `fase1-providers-configstore.test.ts`, `fase1-routes.test.ts` (42 casos de rota).

### Estratégia de segurança mantida
- Segredos **só no banco** (AgentMemory, RLS) — nunca localStorage/front-end.
- "Sem API / Avançado" = abstração + **aviso de risco** (ToS/LGPD), NUNCA automação evasiva em silêncio.
- Dual-schema drift respeitado (leitura de `meta_integrations` por service_role, sem DDL novo).

## FASE 4 — links de e-mail
- Links `0.0.0.0` → `https://revolutionx.com.br` (commits `50c5e8c`, `4bdd1cf`); hard-fallback presente.

## Restam [HUMANO]
1. **Credenciais no hpanel (Hostinger → Env Vars)**: `EMAIL_PROVIDER=resend` + `EMAIL_API_KEY` +
   `EMAIL_FROM`; `META_APP_ID`/`META_APP_SECRET`/`META_WHATSAPP_*`; `OMNIROUTER_*` (opcional).
   Depois: re-deploy.
2. **Confirmar entrega do e-mail de reset** + click no link (caixa Resend/Gmail).
3. **claude-mem `/login`**: observer deslogado desde 2026-10-08 (falha de memória persistente).

## Próximos passos (autônomo, FASE 1 → 2)
1. **UI**: reestruturar `/integrations` (seções "API Oficial" vs "Sem API" + "Integrar" + health)
   e nova tela `/whatsapp` (mass-send, templates, chatbot, extração "Sem API" c/ risco).
2. Componentes compartilhados `RiskBanner`/`ApiBadge` + link `/whatsapp` no `AppNav` (grupo ADMIN).
3. FASE 2: IG/FB/TikTok (login + post/stories/reels + agendamento via API oficial primeiro).
