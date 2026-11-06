# PLANO DE EXECUÇÃO — Revolution X (pós-auditoria 2026-11-06)

> Sequência por dependência, não por vitrine. Cada tarefa: problema que resolve, arquivos,
> dependências, critério de conclusão (DoD), teste, prioridade, status.
> Nada aqui foi executado ainda — aguarda aprovação do plano.

## FASE 0 — Estancar sangramento (horas; sem risco)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 0.1 | Tornar repo privado | C-1 | (GitHub settings) | decisão D-1 | API: `private=true` | P0 | aguarda D-1 |
| 0.2 | Congelar produção: nenhum deploy até fim da Fase 2 | C-4 | — | — | hPanel sem novos builds | P0 | — |
| 0.3 | Decidir e registrar D-2..D-11 | A-1/Ds | DECISOES_PENDENTES.md | dono | decisões marcadas | P0 | aguarda dono |

## FASE 1 — Segurança de credenciais (1 dia; depende 0.1/0.2)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 1.1 | Girar credenciais expostas (banco, Meta secret/encryption key/verify token, Resend, OpenBSP, cron, admin token, service_role, JWT) | C-1 | Supabase/Meta/hPanel + `.env.local` + hPanel | 0.1 | login smoke prod 200; nenhuma credencial antiga válida | P0 | — |
| 1.2 | Remover docs com segredos do repo + política nova | C-1 | AUDITORIA.md, CREDENCIAIS.md, AUDIT_REPORT_*.json, inventory-env.md, CLAUDE.md, AGENTS.md | 1.1 | `git ls-files` sem segredo; gitleaks limpo | P0 | — |
| 1.3 | Purgar histórico (filter-repo) + force-push | C-1 | todo o repo | 1.1, 1.2 | blob antigo ausente; CI verde | P1 | — |
| 1.4 | gitleaks no CI bloqueando push | C-1 | .github/workflows | 1.2 | PR com seed de teste falha | P1 | — |

## FASE 2 — Recuperar trunk verde (1–2 dias; paralelizável com 1)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 2.1 | Decidir WIP da tela de integrações: reverter para último estado commitado íntegro OU terminar ChannelPicker | C-4 | app/integracoes/page.tsx, src/components/ui/ChannelPicker.tsx | — | tsc 0 | P0 | — |
| 2.2 | Consolidar OAuth Meta (D-3): apontar init para callbacks novos, adaptar testes, deletar geração morta e teste órfão | C-3 | app/api/auth/meta, app/api/oauth/callback/*, route.test.ts | 2.1 | suíte verde; teste de integração init→callback com mocks | P0 | — |
| 2.3 | Consertar teste connect OpenBSP (body parse antes do gate 503 — validar body com try/catch e manter 503) | C-4 | app/api/integrations/openbsp/connect/route.ts, whatsapp-official-routes.test.ts | — | teste passa sem enfraquecer contrato | P0 | — |
| 2.4 | Enxugar deps de produção (playwright/puppeteer/qoder-sdk → dev ou fora) | A-7 | package.json | — | build ok, host sem browsers | P1 | — |
| 2.5 | Unificar branches refactor → main; apagar worktrees mortos; redesplegar | C-4 | git | 2.1–2.3 | origin/main == produção == suíte verde | P0 | — |

## FASE 3 — Banco: verdade única (2–3 dias; depois de 2)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 3.1 | Baseline do Prisma Migrate (ou ledger formal) sobre o schema real de produção | A-4 | prisma/migrations novo, supabase/migrations arquivado | 2.5 | `migrate status` limpo em prod (dry) e local | P0 | — |
| 3.2 | Cadeia RLS: policies tenant + FORCE em todas as tabelas com organization_id | C-2 | migration 028_tenant_rls.sql | 3.1 | introspecção: RLS forced = todas; suíte rls 41/41 adaptada | P0 | — |
| 3.3 | Auditoria service_role: revisar toda rota; substituir por anon+RLS ou withUserContext onde possível | C-2 | rotas app/api/** | 3.2 | lista de exceções justificadas ≤ 5 rotas | P0 | — |
| 3.4 | Suíte de autorização negativa por rota (tenant A não vê/altera B) | C-2 | src/tests/authz-negative | 3.2 | 100% das rotas de leitura com teste cruzado | P0 | — |

## FASE 4 — Fluxos reais de produto (3–5 dias; depois de 2, em paralelo com 3)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 4.1 | Piloto OpenBSP ponta a ponta com 1 org de teste (conectar→template→send→auto-reply→inbox→relatório) | A-5 | /integracoes, whatsapp | 2.2 | linha em whatsapp_channels + conversa real gravada | P0 | — |
| 4.2 | UI honesta para scrapers ("em breve") OU executor real (D-4) | A-2 | ScraperPageLayout, app/scrapers | D-4 | nenhum resultado simulado na tela | P1 | — |
| 4.3 | Mover páginas scrapers para `app/` e deduplicar | A-3 | src/app/scrapers → app/scrapers | — | rotas respondem 200 | P2 | — |
| 4.4 | Inbox/mensagens: página de conversas por contato (Fase 8 do roadmap) | lacuna | app/messages, api | 3.2 | conversa do piloto 4.1 visível | P1 | — |
| 4.5 | Casa de faxina: arquivar migrations raiz, dirs de agentes fora do git, CLAUDE.md únicos, worktrees | A-3 | vários | 2.5 | repo enxuto, build verde | P2 | — |

## FASE 5 — Automação e agendamento confiáveis (2–3 dias; depois de 2.5)

| ID | Tarefa | Resolve | Arquivos | Dep | DoD / Teste | Prio | Status |
|---|---|---|---|---|---|---|---|
| 5.1 | Internalizar WF-02/WF-05 como rotas cron autenticadas (D-11b) OU consertar API do n8n | A-6 | app/api/cron/*, n8n | D-11 | job roda sem MCP cloud; alerta em falha | P1 | — |
| 5.2 | Configurar cron Hostinger (CRON_SECRET + /api/cron/tiktok + novos ticks) | B-1 | hPanel | 2.5 | GET /api/cron/tiktok 405; POST 200 agregado | P1 | — |
| 5.3 | Uptime monitoring externo (Healthchecks.io/UptimeRobot free) + alerta WhatsApp admin | M-2 | infra | — | incidente de teste notificado | P2 | — |

## FASE 6 — Go comercial (planejar depois de 3+4)

| ID | Tarefa | Resolve | Dep | DoD | Prio | Status |
|---|---|---|---|---|---|---|
| 6.1 | Planos + limites + gating por plano (D-9) | lacuna de produto | dono decidiu | tenant free barrado em limite X com teste | P1 | — |
| 6.2 | Checkout/pagamento (Mercado Pago/Stripe/Pix) | idem | 6.1 | assinatura ativa sem intervenção manual | P1 | — |
| 6.3 | Meta App Review follow-up (H-1/H-2) e ligar ENABLE_META_OAUTH | D-10 | humanos | OAuth real num tenant de teste | P0-humano | aguarda Meta |
| 6.4 | IA produção (D-7) + limites por tenant | — | dono | /api/ai/generate real em prod | P1 | — |

## FASE 7 — Endurecimento final (contínuo)

- 7.1 Suíte E2E Playwright autenticada (registro→login→integração→mensagem) contra staging.
- 7.2 Carga básica (k6) no tick multi-tenant e webhooks.
- 7.3 Revisão LGPD: consentimento, exclusão de dado pessoal (direito ao esquecimento),
  logs de risco de scraping.
- 7.4 Runbook de incidentes (DB, OAuth expirado, webhook fora).

## Regras transversais

1. Antes de mexer em qualquer rota de auth/dados: reler PROBLEMAS_E_BLOQUEIOS C-2.
2. Todo item concluído atualiza STATUS_GERAL.md + HISTORICO_DE_IMPLEMENTACAO.md com evidência.
3. Nenhum commit "chore" pode misturar ferramentas de agente com código de app (causa do C-3).
4. Build verde ≠ feature pronta: fechar item exige evidência de fluxo real ou teste de integração.
