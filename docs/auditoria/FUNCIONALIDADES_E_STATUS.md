# FUNCIONALIDADES E STATUS — Revolution X

> Auditoria 2026-11-06. Estado = o que se pode PROVAR hoje. "tela existe" não conta como pronto.
> Legenda: ✅ funcionando de verdade · 🟡 parcial · ⛔ não implementado · 🚫 quebrado · ❓ não verificável sem ação humana

## Módulo 1 — Auth + multi-tenant (FASE 2)
Objetivo: registro, login, verificação de e-mail, reset, sessão, organização por usuário, RBAC.
- ✅ Registro → GoTrue → onboarding (Organization + Member admin) com rollback compensado (P4-2)
- ✅ Login/logout/session/forgot/reset/verify-email: rotas + testes
- ✅ E-mail transacional production (Resend SMTP no GoTrue): register 201 + delivered (evidência 2026-10-29/11-03)
- ✅ RBAC owner/admin/member (`src/services/rbac.ts`)
- 🚫 **Isolamento por RLS em produção**: só 5/41 tabelas com RLS forçado; 6 policies no total
  (documentos antigos diziam "FORCE RLS em todas as tabelas public" — falso hoje). Causa:
  reset do banco de produção (commit b4d2426 "restore production schema after db reset")
  recriou schema sem a cadeia 007/008 completa.
- Dependências: Supabase (GoTrue), tabela public."User", JWT.
- Como finalizar: reintroduzir cadeia RLS (007/008/009 equivalentes) sobre o schema atual
  + suíte de autorização negativa por rota.

## Módulo 2 — Banco/CRM (FASE 3)
Objetivo: contatos, leads, deals, pipelines, importação.
- ✅ Rotas /api/crm/* completas (contacts, leads, deals, pipelines, import)
- ✅ UI /crm/* existe; lead funnel (growth_leads, migração 023) aplicado
- 🟡 crmRepoReal usa BYPASSRLS com `where` manual — funciona, mas depende de disciplina de código
- ❓ Dados reais de cliente em produção nunca validados ponta a ponta nesta auditoria

## Módulo 3 — Produtos + mídia (FASE 4)
- ✅ CRUD produtos; Media model existe
- 🟡 Upload real de mídia/Storage S3 não configurado (S3_* no .env.example, vazio) → biblioteca de mídia é limitada a URLs

## Módulo 4 — Publicador + calendário (FASE 5)
- ✅ Models Post/CalendarEvent, rotas /api/schedules, UI /calendar, /publisher
- 🟡 Integração do calendário com publicações agendadas REAIS existe só por canal (IG/FB agendamento oficial ✅; fila TikTok via tick ✅ código; UI publisher genérica não dispara por canal)

## Módulo 5 — Vídeo (FASE 6)
- ⛔ Placeholder `/video` (o roadmap pedia "Vídeo"; nunca houve especificação além do nome)
- Dependência: decisão de produto (biblioteca? edição? só upload p/ publicações?)

## Módulo 6 — WhatsApp (FASE 7)
Objetivo: disparo em massa, templates, chatbot, auto-reply, oficial (Meta/OpenBSP) e QR.
- ✅ Cloud API oficial: send (texto/template/botões), runMassSend, templates GET/POST, chatbot engine (regras + steps + {{var}} + quick replies + janela), auto-reply no webhook Meta — tudo com testes
- ✅ Webhook Meta: verificação GET, HMAC, idempotência (claim atômico)
- 🟡 OpenBSP (WhatsApp "oficial" multi-tenant via Embedded Signup): código completo (connect/callback/incoming/status/disconnect/templates), testes; **nenhum canal conectado em produção** (whatsapp_channels/meta_integrations = 0) → fluxo nunca percorrido por usuário real
- 🟡 QR/não-oficial: cards + rota manual connect existente (Evolution API prevista; EVOLUTION_* no .env.local) — executor/instalação Evolution não comprovados
- ❓ Credenciais Meta no hPanel de produção (META_* presentes no .env.local local; produção não confirmada)

## Módulo 7 — Central de mensagens (FASE 8)
- ✅ Model Message + ingestão do webhook
- 🟡 UI de caixa de entrada unificada (conversas, histórico por contato) — não encontrada página dedicada de inbox; /whatsapp mostra cards operacionais, não conversas

## Módulo 8 — Campanhas / tráfego pago (FASE 9)
- ✅ Campanhas CRUD + recipients + accountId por conta Meta (código + testes; tabelas Campaign/CampaignRecipient existem)
- ✅ Meta Ads insights (Marketing API) e TikTok Ads insights (Business API) — backend + cards
- 🚫 Disparo de campanha REAL depende de Meta system user token / review de escopos (H-1/H-2, humanos) e de `ads_read` aprovado; hoje `resolveTenantMetaAdsAccess` não tem token válido → degrada honesto
- ⛔ Google Ads (citado no README) — nunca implementado, nem especificado

## Módulo 9 — IA (FASE 10)
- ✅ omniRouter (OpenAI-compatível, retry, fallback chain, auto-select) — dev validado com FreeLLMAPI local
- ✅ Admin chat SSE + fila de tasks (014) + AgentMemory
- 🟡 Produção: OMNIROUTER_* no hPanel — estado atual não confirmado nesta auditoria (❓)

## Módulo 10 — Relatórios (FASE 11)
- ✅ /reports + Report model + ads-insights cards
- 🟡 Relatórios agregados por tenant (mensal, por canal) — superficiais

## Módulo 11 — Segurança + produção (FASE 12)
- ✅ HSTS, redirect http→https, CI, deploy automático, smoke
- ✅ Tokens OAuth AES-256-GCM em repouso
- 🚫 Segredos em repo público (C-1) — ver PROBLEMAS_E_BLOQUEIOS.md
- 🚫 RLS produção (C-2)

## PROMPT MESTRE §3 — itens "sem API" (scrapers/automação de navegador)
- 🚫 **UI de scrapers existe (5 páginas) mas devolve texto `[PLACEHOLDER]`**
  (src/components/scrappers/ScraperPageLayout.tsx:32-34) — apresenta-se como resultado real
- 🟡 publicScraper.ts existe com guarda SSRF sólida + rota /api/scrapers/instagram/profile
- ⛔ executores de: extrair contatos de grupos/conversas, seguir seguidores, anúncios em
  grupos/Marketplace, disparo em massa QR — declarados na UI com RiskBanner, nenhum executor
- Decisão honesta necessária: o PROMPT MESTRE pede esses métodos, mas são violação de ToS
  das plataformas e risco LGPD; hoje a UI promete e o backend não entrega (pior cenário
  para o usuário leigo). Ver DECISOES_PENDENTES D-4.

## Integrações de terceiros (§3.7)
- ✅ n8n inbound (config + webhook), outbound executors (n8n/Zapier/Make/webhook genérico c/ HMAC)
- 🟡 n8n workflows WF-01..08 rodam só via MCP cloud (API REST local 401 — bloqueio conhecido)
- ✅ Meta CAPI (evento teste aceito)
- 🟡 Resend (e-mail) — production OK via GoTrue; SDK de transacionais direct não usado

## Hub de integrações (§3.7d)
- ✅ /integracoes canônica com 308 de /integrations e /hub-integracoes (provado em produção)
- 🟡 **HEAD atual tem trabalho incompleto QUEBRADO**: app/integracoes/page.tsx com sintaxe
  inválida (`{(>` ... `)}}`) + ChannelPicker novo não conectado; tsc falha; Instagram/Facebook
  removidos da tela enquanto a versão commitada ainda os tinha
- 🟡 Branch atual = `refactor/db-adapter-f1` com 8 commits à frente de origin/main (não made in prod)
