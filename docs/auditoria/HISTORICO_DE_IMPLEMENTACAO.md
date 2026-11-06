# HISTÓRICO DE IMPLEMENTAÇÃO — Revolution X

> Registro contínuo do que foi feito no projeto, na cronologia. Entrada nova no topo.
> Regra: toda linha tem evidência (commit/arquivo/medição).

## 2026-11-06 (tarde) — FASE 2 executada: trunk verde
- page.tsx restaurado p/ estado commitado íntegro (288dd66); WIP corrompido revertido.
- Callback Meta restaurado de 288dd66 byte-a-byte; oauth/callback/{facebook,instagram,whatsapp} deletados (persistiam na tabela errada, sem callers). whatsapp-qr preservado.
- openbsp/connect: req.json().catch(() => ({})) — corpo ausente vira official; contrato 503 preservado.
- package.json: puppeteer, puppeteer-core, @qoder-agent-sdk removidos; playwright MANTIDO (manualLogin.ts:60 faz chromium.launch em produção).
- Medição pós-FASE 2: tsc 0 · eslint 0 · jest 834/834 (60 suítes) · build OK · lockfile -23 pacotes.
- ChannelPicker.tsx corrigido (tsc 0); continua órfão por decisão.
## 2026-11-06 — Auditoria completa (esta sessão)
- Diagnóstico técnico de todo o repo, docs, banco de produção (somente-leitura) e produção viva.
- Criada a documentação permanente em `docs/auditoria/` (9 documentos) + `STATUS_GERAL.md`.
- **Nenhum código alterado** (regra §10 da missão).
- Achados novos (não constavam em nenhum doc anterior): RLS de produção 5/41 (C-2),
  callback OAuth Meta deletado com fluxo morto (C-3), main de dev quebrada (tsc 2 erros,
  suíte 1 falha) (C-4), docs com segredos em repo público ainda rastre**ados (C-1 — a
  sanitização anterior só tinha mascarado BLOCKERS.md), _prisma_migrations=2 linhas,
  0 tenants conectados em produção, migração 016 JÁ está em produção (docs diziam pendente).

## Linha do tempo consolidada (das fontes históricas)

- 2026-09-21 — criação do projeto; roadmap de 12 fases (README).
- 2026-10-15..19 — missões FASE A–I: quick wins, testes admin/webhook (G1/G3), migrations
  014/015 em produção, CI com Postgres descartável, repo público, rotação de senha do banco
  (2x — segunda por exposição em chat/índice claude-mem), PROMPT MESTRE §1–§8 recebido,
  hub de integrações F1–F3 + chatbot visual + executors n8n/Zapier/Make + tracking ads.
- 2026-10-20..26 — OpenBSP contratado/integrado (mint validado), growth CRM/lead funnel,
  reset do banco de produção + restore manual (aqui nasce o débito RLS de C-2),
  migrations 018–024a, auditoria do Google/docs/*.
- 2026-10-27..29 — protocolo P0.8 (bloqueios humanos H-1..H-4), GoTrue SMTP resolvido
  (Resend), CAPI evento teste aceito, SearXNG local.
- 2026-10-31..11-03 — App Review Meta submetido; n8n WF-04 severity corrigido (exec #75);
  multi-conta Meta 70 testes; FreeLLMAPI local como IA dev; BLOCKERS.md mascarado.
- 2026-11-04 — gates F1/F2/F3 (IntegrationCard único, /integrations, whatsapp oficial),
  833/833 na época; migrações 024–027 aplicadas a produção.
- 2026-11-05 — fase A (redirects 308 provados), F1.01–F1.08 (DatabaseAdapter), routing
  mode official/non_official (`abedc93`), commit `1a87fc7` deleta o callback Meta
  (sem intenção declarada) → base quebra; deploy de produção feito de 288dd66 com build fix.
- 2026-11-06 — esta auditoria.

## Pendências legadas que se mantêm
- H-1 System User Token, H-2 App Review (humanos; estado: aguardando Meta).
- Cron Hostinger + credenciais no hPanel (confirmar estado atual).
- GoTrue SITE_URL localhost em produção (M-3).


