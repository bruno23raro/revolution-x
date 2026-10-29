# REVOLUTION X — SaaS Omnichannel

> Criado em 2026-09-21 dentro de `C:\Users\User\.claude\Revolution\X`
> Arquitetura modular. Nunca destruir o existente.

## FASES (nunca pular)

1. Inicialização + análise de ambiente ✅ (executado agora)
2. Auth + multi-tenant
3. Banco + CRM
4. Produtos + mídia
5. Publicador + calendário
6. Vídeo
7. WhatsApp
8. Central de mensagens
9. Campanhas de tráfego pago
10. IA
11. Relatórios
12. Segurança + produção

## REGRAS
- Nenhuma API inventada.
- Pesquisa documentação oficial antes de implementar.
- Classifique: A) automática | B) homologação | C) assistido | D) manual
- Não armazene senhas; use OAuth/tokens.
- Dados por tenant (`organization_id`).
- Commit pequeno, teste antes de avançar.
- Se precisar de conta externa: mostre tela simples para leigo.

## ESTRUTURA PROPOSTA

```
RevolutionX/
├── apps/
│   ├── web/          (Next.js + React + TS + Tailwind)
│   ├── api/          (REST + Webhooks)
│   └── workers/      (BullMQ + Redis jobs)
├── packages/
│   ├── db/           (PostgreSQL migrations + repos)
│   ├── connectors/   (/meta /whatsapp /instagram /facebook /google-ads /tiktok /olx /linkedin /google-business)
│   └── ai/           (assistente central)
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── integrations.md
│   └── SETUP-LEIGO.md
├── .env.example
├── README.md
└── docker-compose.yml
```

## SERVIÇOS EXTERNOS (estimativa de custo)

| Serviço | Uso | Custo estimado |
|---|---|---|
| PostgreSQL (Neon/Render) | Banco multi-tenant | Gratuito/low-cost inicial |
| Redis (Upstash/Render) | Fila + cache | Gratuito até limite |
| Storage S3-compatível | Arquivos de mídia | Gratuito/low-cost |
| WhatsApp Business API (Meta) | Envio de templates/campanhas | Precisa de conta Meta + aprovação |
| Meta Ads / Google Ads | Tráfego pago | Só gasto quando usuário confirmar |
| OpenAI/Anthropic API | IA de conteúdo | Pay-per-use |

## PRÓXIMO PASSO

Executar FASE 2: autenticação e multi-tenant (users, organizations, roles, permissions).
Antes: analisar arquivo existente se houver código anterior.

## INTEGRAÇÕES ATIVAS (estado 2026-10-29)

| Integração | Como funciona | Config | Validação |
|---|---|---|---|
| Meta Login/Graph (app 1112157761403064) | OAuth por usuário; tokens criptografados (AES-GCM) na tabela `integrations` (migração 018) | `META_APP_ID/SECRET`, `META_TOKEN_ENCRYPTION_KEY` em `.env.local` | 11 scopes mantidos; análise em andamento na Meta |
| Meta CAPI | `src/integrations/meta/capi.ts` → POST `graph.facebook.com/v26.0/{PIXEL}/events`; dedup por `(event_name,event_id)`; e-mail/telefone SHA-256 | `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` | evento teste aceito (`events_received:1`, 2026-10-29) |
| WhatsApp Cloud API | templates + mensagens via WABA; token system user | `WHATSAPP_ACCESS_TOKEN`, `WABA_ID` | webhook verificado (GET 200 / POST sem assinatura 401) |
| Resend (email) | SMTP `smtp.resend.com:465` no GoTrue + SDK p/ transacionais | `EMAIL_API_KEY`, `EMAIL_FROM` no `.env.local` **e** hPanel | registro produção 201 + e-mail de verificação delivered (2026-10-29) |
| Refresh de tokens (cron) | `scripts/refresh-tokens.js` renova tokens OAuth expirados | cron hPanel `0 3 * * *` (uid `cEokuaB3WI`), caminho `hbuilds/current/nodejs` | listado via API Hostinger |
| IA local (Ollama) | OpenAI-compatível `http://localhost:11434/v1`, modelo `llama3.1:8b` | `AI_API_URL`, `AI_API_KEY=ollama`, `AI_MODEL` | chat completion OK |
| Busca (SearXNG) | agregador local de Google/Bing/DDG/Wikipedia com API JSON; MCP `search` (`scripts/mcp-search/server.mjs`) | `SEARXNG_URL=http://localhost:8888`; container `rx-searxng` | `/search?format=json` → 43 resultados |
| Supabase dev local | stack self-hosted docker (gateway :8432) p/ testes de schema | `supabase-docker/` | cadeia 002a→018 aplicada local |

Credenciais: apenas máscaras em `CREDENCIAIS.md`; valores vivem em `.env` / `.env.local` (gitignored). NUNCA rodar scripts de apply do DEV contra o projeto de produção.
