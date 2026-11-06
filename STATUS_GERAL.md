# STATUS_GERAL — fonte de verdade do Revolution X

> Atualizado: 2026-11-06 | medição direta (commit 88625c6, branch refactor/db-adapter-f1)
> Este arquivo substitui as cifras de estado espalhadas em outros docs. Se outro doc
> contradiz este, o outro está desatualizado (marcar como histórico).

## Medição de hoje (nada aqui é herdado de documento anterior)

| Métrica | Valor real | Como foi medido |
|---|---|---|
| Typecheck | **0 erros** ✅ | `npx tsc --noEmit` (pós-FASE 2) |
| Testes | **834/834 · 60/60 suítes** ✅ | `npx jest` (pós-FASE 2) |
| Lint | verde (baseline histórico; revalidar após corrigir tsc) | docs + pendência |
| Build/produção | **NO AR** — revolutionx.com.br 200; /integrations 308 ok | HTTP vivo |
| Banco produção | 41 tabelas; **RLS forçado em 5**; 6 policies; _prisma_migrations=2 | introspecção somente-leitura |
| Tenants ativos | **0 integrações conectadas** (meta_integrations vazio) | `select count(*)` |
| Repo GitHub | **PÚBLICO com segredos versionados** (correção urgente) | API GitHub + git ls-files |
| OAuth Meta | **restaurado** (callback de 288dd66 + callbacks órfãos removidos; flag off até D-10) | git + jest 12/12 rota |

## Semáforo por área

- ✅ Deploy/CI/domínio · Auth (código) · E-mail transacional · CRM (unidades) · IA dev
- 🟡 WhatsApp oficial OpenBSP (código pronto, zero piloto real) · Scrapers (UI simula)
  · Planos/cobrança (sem lógica) · Fila (escala limitada)
- 🔴 Segurança de segredos (C-1) · Isolamento RLS produção (C-2) · OAuth Meta (C-3)
  · Trunk de desenvolvimento (C-4) · n8n em produção (A-6)

## Os 5 próximos passos imediatos (após aprovação do plano)

1. **D-1**: tornar repo privado (1 clique) → depois girar credenciais (FASE 1).
2. **2.1+2.3**: trunk verde (page.tsx + teste OpenBSP) — tsc 0, suíte 100%.
3. **2.2**: consolidar OAuth Meta numa geração só (D-3) e restaurar testes.
4. **3.2+3.3**: cadeia RLS de tenant em produção + auditoria service_role.
5. **4.1**: piloto ponta a ponta com 1 organização de teste.

## O que depende do dono

D-1 repo privado · D-2 giro de credenciais · D-3 geração OAuth · D-4 scrapers
(entregar/congelar/cortar) · D-5 preço WhatsApp · D-6 contrato OpenBSP · D-7 IA produção
· D-8 Google Ads/Vídeo · D-9 planos e cobrança · D-10 ligar OAuth quando review sair
· D-11 n8n internalizado.  Detalhe em docs/auditoria/DECISOES_PENDENTES.md.

## Bloqueios humanos externos (incontornáveis)

- Meta App Review (em análise desde 2026-10-31) e System User Token (Business Manager).
- Credenciais/variáveis no hPanel Hostinger + SITE_URL GoTrue + cron.

## Índice da documentação de auditoria

docs/auditoria/VISAO_GERAL_PROJETO.md · ARQUITETURA_ATUAL.md · FUNCIONALIDADES_E_STATUS.md ·
AUDITORIA_INTEGRACOES.md · PROBLEMAS_E_BLOQUEIOS.md · DECISOES_PENDENTES.md ·
PLANO_DE_EXECUCAO.md · HISTORICO_DE_IMPLEMENTACAO.md · TESTES_E_VALIDACOES.md

